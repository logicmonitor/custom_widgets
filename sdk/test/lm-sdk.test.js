'use strict';

// Unit tests for lm-sdk.js. Run with: node --test sdk/test
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const lmDefault = require('../lm-sdk.js');

/**
 * Builds a fake fetch Response.
 *
 * @param {number} status - HTTP status.
 * @param {*} body - JSON body (object) or raw string.
 * @param {object} [headers] - Response headers.
 * @returns {object} Response-like object.
 */
function fakeResponse(status, body, headers) {
	const h = headers || {};
	const text = typeof body === 'string' ? body : JSON.stringify(body === undefined ? '' : body);
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: 'S' + status,
		headers: { get: (k) => h[Object.keys(h).find((x) => x.toLowerCase() === k.toLowerCase())] || null },
		text: async () => (body === undefined ? '' : text)
	};
}

/**
 * Creates an SDK instance whose fetch is scripted.
 *
 * @param {Function} handler - (url, init, callIndex) => Response.
 * @param {object} [extra] - Extra configuration.
 * @returns {{lm: object, calls: Array}} Instance and recorded calls.
 */
function makeLM(handler, extra) {
	const calls = [];
	const fetchFn = async (url, init) => {
		calls.push({ url, init });
		return handler(url, init, calls.length - 1);
	};
	const lm = lmDefault.create(Object.assign({ fetch: fetchFn, retry: { max: 2, baseMs: 1 }, logLevel: 'silent' }, extra || {}));
	return { lm, calls };
}

test('query builder builds LM filter syntax with operators and escaping', () => {
	const q = lmDefault.query('devices')
		.addQuery('hostStatus', 'normal')
		.addQuery('displayName', '~', 'prod')
		.addQuery('id', '>=', 5)
		.addOrQuery('name', '!=', 'a"b');
	assert.strictEqual(q.getFilter(), 'hostStatus:"normal",displayName~"prod",id>:5||name!:"a\\"b"');
	assert.throws(() => lmDefault.query('devices').addQuery('a', 'bogus', 1), /Unsupported filter operator/);
	assert.throws(() => lmDefault.query('nope'), /Unknown resource/);
});

test('query params include fields, sort, size and offset', () => {
	const p = lmDefault.query('/device/devices').fields(['id', 'name']).orderByDesc('name').pageSize(50).getParams(100);
	assert.deepStrictEqual(p, { size: 50, offset: 100, fields: 'id,name', sort: '-name' });
});

test('LMv1 signature is base64 of the hex HMAC-SHA256', async () => {
	const { lm } = makeLM(() => fakeResponse(200, {}), { accessId: 'ID123', accessKey: 'secretkey' });
	const epoch = 1700000000000;
	const header = await lm.auth.signLMv1('POST', '/device/devices', { a: 1 }, epoch);
	const hex = crypto.createHmac('sha256', 'secretkey').update('POST' + epoch + '{"a":1}' + '/device/devices').digest('hex');
	assert.strictEqual(header, 'LMv1 ID123:' + Buffer.from(hex).toString('base64') + ':' + epoch);
	const getHeader = await lm.auth.signLMv1('GET', '/x', { ignored: true }, epoch);
	const hexGet = crypto.createHmac('sha256', 'secretkey').update('GET' + epoch + '/x').digest('hex');
	assert.ok(getHeader.indexOf(Buffer.from(hexGet).toString('base64')) !== -1);
});

test('placeholder tokens are treated as not set and auth mode priority holds', () => {
	const { lm } = makeLM(() => fakeResponse(200, {}));
	assert.strictEqual(lm.auth.mode(), 'session');
	lm.configure({ bearerToken: '##apiBearerToken##', accessId: '##apiID##', accessKey: '##apiKey##' });
	assert.strictEqual(lm.auth.mode(), 'session');
	lm.configure({ accessId: 'id', accessKey: 'key' });
	assert.strictEqual(lm.auth.mode(), 'lmv1');
	lm.configure({ bearerToken: 'tok' });
	assert.strictEqual(lm.auth.mode(), 'bearer');
	assert.ok(lm.nil('##x##'));
	assert.ok(!lm.nil('value'));
});

test('session auth fetches one shared CSRF token and sends it', async () => {
	const { lm, calls } = makeLM((url) => {
		if (url.indexOf('/functions/dummy') !== -1) return fakeResponse(200, {}, { 'X-Csrf-Token': 'abc' });
		return fakeResponse(200, { id: 1 });
	});
	await Promise.all([lm.get('/device/devices/1'), lm.get('/device/devices/2')]);
	const csrfCalls = calls.filter((c) => c.url.indexOf('/functions/dummy') !== -1);
	assert.strictEqual(csrfCalls.length, 1);
	const dataCall = calls.find((c) => c.url.indexOf('/device/devices/1') !== -1);
	assert.strictEqual(dataCall.init.headers['X-Csrf-Token'], 'abc');
	assert.strictEqual(dataCall.init.credentials, 'include');
});

test('session auth refreshes the CSRF token once on 403', async () => {
	let dataHits = 0;
	let tokenHits = 0;
	const { lm } = makeLM((url) => {
		if (url.indexOf('/functions/dummy') !== -1) {
			tokenHits++;
			return fakeResponse(200, {}, { 'X-Csrf-Token': 't' + tokenHits });
		}
		dataHits++;
		return dataHits === 1 ? fakeResponse(403, { errorMessage: 'bad csrf' }) : fakeResponse(200, { ok: true });
	});
	const data = await lm.get('/x');
	assert.deepStrictEqual(data, { ok: true });
	assert.strictEqual(tokenHits, 2);
});

test('bearer auth header, version header and error enrichment', async () => {
	const { lm, calls } = makeLM(() => fakeResponse(404, { errorMessage: 'Not found', errorCode: 1404 }), { bearerToken: 'tok' });
	await assert.rejects(lm.get('/device/devices/9'), (e) => {
		assert.ok(e instanceof lmDefault.LMError);
		assert.strictEqual(e.status, 404);
		assert.strictEqual(e.code, 1404);
		assert.match(e.message, /Not found/);
		return true;
	});
	assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer tok');
	assert.strictEqual(calls[0].init.headers['X-Version'], '3');
	assert.strictEqual(calls.length, 1);
});

test('429 is retried and 204 returns an empty object', async () => {
	let n = 0;
	const { lm } = makeLM(() => (++n === 1 ? fakeResponse(429, {}) : fakeResponse(204, undefined)), { bearerToken: 't' });
	assert.deepStrictEqual(await lm.get('/x'), {});
	assert.strictEqual(n, 2);
});

test('request validates path and verb', async () => {
	const { lm } = makeLM(() => fakeResponse(200, {}), { bearerToken: 't' });
	await assert.rejects(lm.client.request({}), /path/);
	await assert.rejects(lm.client.request({ path: '/x', verb: 'TRACE' }), /Invalid verb/);
});

test('getAll pages through results', async () => {
	const all = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
	const { lm, calls } = makeLM((url) => {
		const offset = Number(/offset=(\d+)/.exec(url)[1]);
		return fakeResponse(200, { total: 2500, items: all.slice(offset, offset + 1000) });
	}, { bearerToken: 't' });
	const progress = [];
	const res = await lm.getAll('/device/devices', { onProgress: (l) => progress.push(l) });
	assert.strictEqual(res.items.length, 2500);
	assert.strictEqual(calls.length, 3);
	assert.deepStrictEqual(progress, [1000, 2000, 2500]);
});

test('getAll stops on an empty page instead of looping forever', async () => {
	let n = 0;
	const { lm } = makeLM(() => (++n === 1
		? fakeResponse(200, { total: 5000, items: [{ id: 1 }] })
		: fakeResponse(200, { total: 5000, items: [] })), { bearerToken: 't' });
	const res = await lm.getAll('/x', { size: 1 });
	assert.strictEqual(res.items.length, 1);
	assert.strictEqual(n, 2);
});

test('getAll handles negative totals (alerts) and honors maxItems', async () => {
	let n = 0;
	const { lm } = makeLM(() => {
		n++;
		return fakeResponse(200, { total: -1, items: n === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }] });
	}, { bearerToken: 't' });
	const res = await lm.getAll('/alert/alerts', { size: 2 });
	assert.strictEqual(res.items.length, 3);
	const limited = await lm.query('alerts').limit(1).getItems();
	assert.strictEqual(limited.length, 1);
});

test('shortcuts build correct paths and filters', async () => {
	const { lm, calls } = makeLM(() => fakeResponse(200, { total: 1, items: [{ id: 1 }] }), { bearerToken: 't' });
	await lm.getDevices({ filter: { hostStatus: 'normal' }, fields: 'id,displayName' });
	assert.match(decodeURIComponent(calls[0].url), /\/device\/devices\?.*filter=hostStatus:"normal"/);
	await lm.getDeviceInstances(5, 7, { filter: [['name', '~', 'eth']] });
	assert.match(calls[1].url, /\/device\/devices\/5\/devicedatasources\/7\/instances\?/);
	await lm.getInstanceData(1, 2, 3, { start: 10, end: 20 });
	assert.match(calls[2].url, /\/instances\/3\/data\?start=10&end=20$/);
});

test('getDatasourceInstances resolves a datasource name to its instances', async () => {
	const { lm, calls } = makeLM((url) => {
		const u = decodeURIComponent(url);
		if (u.indexOf('/setting/datasources') !== -1) return fakeResponse(200, { total: 1, items: [{ id: 42, name: 'WinCPU' }] });
		if (u.indexOf('/devicedatasources?') !== -1) return fakeResponse(200, { total: 1, items: [{ id: 900 }] });
		return fakeResponse(200, { total: 2, items: [{ id: 1 }, { id: 2 }] });
	}, { bearerToken: 't' });
	const items = await lm.getDatasourceInstances(5, 'WinCPU');
	assert.strictEqual(items.length, 2);
	assert.match(decodeURIComponent(calls[0].url), /\/setting\/datasources\?.*filter=name:"WinCPU"/);
	assert.match(decodeURIComponent(calls[1].url), /\/device\/devices\/5\/devicedatasources\?.*filter=dataSourceId:42/);
	assert.match(calls[2].url, /\/device\/devices\/5\/devicedatasources\/900\/instances\?/);
});

test('getDatasourceInstances accepts a single options object', async () => {
	const { lm, calls } = makeLM((url) => {
		const u = decodeURIComponent(url);
		if (u.indexOf('/setting/datasources') !== -1) return fakeResponse(200, { total: 1, items: [{ id: 42 }] });
		if (u.indexOf('/devicedatasources?') !== -1) return fakeResponse(200, { total: 1, items: [{ id: 900 }] });
		return fakeResponse(200, { total: 1, items: [{ id: 1 }] });
	}, { bearerToken: 't' });
	const items = await lm.getDatasourceInstances({ deviceId: 1694, datasource: 'SNMP_Network_Interfaces', maxItems: 100 });
	assert.strictEqual(items.length, 1);
	assert.match(calls[2].url, /\/device\/devices\/1694\/devicedatasources\/900\/instances\?/);
	await assert.rejects(lm.getDatasourceInstances({ datasource: 'x' }), /resource \(device\) id is required/);
});

test('getDatasourceInstances skips the name lookup for a numeric id and handles missing data', async () => {
	const { lm, calls } = makeLM((url) => {
		if (url.indexOf('/devicedatasources?') !== -1) return fakeResponse(200, { total: 0, items: [] });
		return fakeResponse(200, { total: 0, items: [] });
	}, { bearerToken: 't' });
	assert.strictEqual(await lm.getDatasourceId('42'), 42);
	assert.deepStrictEqual(await lm.getDatasourceInstances(5, 42), []);
	assert.strictEqual(calls.length, 1);
	assert.match(decodeURIComponent(calls[0].url), /dataSourceId:42/);
	await assert.rejects(lm.getDatasourceId(''), /required/);
	await assert.rejects(lm.getDatasourceId('Nope'), /Datasource not found: Nope/);
});

test('getProperty searches property arrays', () => {
	const device = { customProperties: [{ name: 'a', value: '1' }], systemProperties: [{ name: 'b', value: '2' }] };
	assert.strictEqual(lmDefault.getProperty(device, 'b'), '2');
	assert.strictEqual(lmDefault.getProperty(device, 'zzz', 'dflt'), 'dflt');
});

test('getStatusColor maps status names to LogicMonitor colors', () => {
	assert.strictEqual(lmDefault.getStatusColor('Critical'), '#DA331A');
	assert.strictEqual(lmDefault.getStatusColor('error'), '#F57202');
	assert.strictEqual(lmDefault.getStatusColor(' WARNING '), '#F5CA1E');
	assert.strictEqual(lmDefault.getStatusColor('warn'), '#F5CA1E');
	assert.strictEqual(lmDefault.getStatusColor('SDT'), '#74D4E5');
	assert.strictEqual(lmDefault.getStatusColor('Acknowledged'), '#AD36BF');
	assert.strictEqual(lmDefault.getStatusColor('acked'), '#AD36BF');
	assert.strictEqual(lmDefault.getStatusColor('Cleared'), '#6BAE3A');
	assert.strictEqual(lmDefault.getStatusColor('clear'), '#6BAE3A');
	assert.strictEqual(lmDefault.getStatusColor('none'), '#6BAE3A');
	assert.strictEqual(lmDefault.getStatusColor(4), '#DA331A');
	assert.strictEqual(lmDefault.getStatusColor('3'), '#F57202');
	assert.strictEqual(lmDefault.getStatusColor(2), '#F5CA1E');
	assert.strictEqual(lmDefault.getStatusColor(1, '#000'), '#000');
	assert.strictEqual(lmDefault.getStatusColor(0), null);
	assert.strictEqual(lmDefault.getStatusColor('bogus'), null);
	assert.strictEqual(lmDefault.getStatusColor('toString', '#000'), '#000');
	assert.strictEqual(lmDefault.getStatusColor(undefined, '#000'), '#000');
});

test('logging honors level, redacts secrets and forwards to transports', () => {
	const { lm } = makeLM(() => fakeResponse(200, {}), { logLevel: 'info', widgetName: 'w' });
	const seen = [];
	lm.logger.addTransport((e) => seen.push(e));
	const orig = console.info;
	console.info = () => {};
	lm.debug('hidden');
	lm.info('Authorization: Bearer abc123', { apiKey: 'xyz', ok: 1 });
	console.info = orig;
	assert.strictEqual(seen.length, 1);
	assert.ok(seen[0].msg.indexOf('abc123') === -1);
	assert.strictEqual(seen[0].meta.apiKey, '[REDACTED]');
	assert.strictEqual(seen[0].meta.ok, 1);
});

test('LM Logs forwarding posts a batch to the ingest endpoint', async () => {
	const { lm, calls } = makeLM(() => fakeResponse(202, {}), {
		bearerToken: 't', logLevel: 'info',
		logs: { enabled: true, resourceId: { 'system.hostname': 'host1' }, batchSize: 100 }
	});
	const orig = console.info;
	console.info = () => {};
	lm.info('hello');
	console.info = orig;
	assert.strictEqual(await lm.logger.flush(), true);
	assert.strictEqual(calls[0].url, '/rest/log/ingest');
	const body = JSON.parse(calls[0].init.body);
	assert.strictEqual(body[0].msg, 'hello');
	assert.deepStrictEqual(body[0]['_lm.resourceId'], { 'system.hostname': 'host1' });
});

test('utilities', () => {
	assert.strictEqual(lmDefault.escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
	assert.ok(lmDefault.isTruthy('Yes'));
	assert.ok(!lmDefault.isTruthy('##flag##'));
	assert.strictEqual(lmDefault.formatDate('bad'), '');
});

/**
 * Builds a minimal fake iframe/parent DOM for context helper tests.
 *
 * @returns {object} Fake window plus the parent pieces.
 */
function makeFakeDom() {
	const styles = {};
	const container = {
		id: 'w1', style: {}, parentElement: { id: 'cell' },
		closest(sel) { return sel.indexOf('DashboardWidgetsGrid') !== -1 ? container : null; },
		querySelector() { return { id: 'title' }; }
	};
	const inner = { id: 'inner', style: {}, closest(sel) { return sel === '[id]' ? container : null; } };
	const frame = Object.assign({}, inner, { id: '', closest(sel) { return sel === '[id]' ? container : null; } });
	const parentDoc = {
		querySelectorAll: () => [frame],
		getElementById: (id) => styles[id] || null,
		createElement: () => ({}),
		head: { appendChild: (el) => { styles[el.id] = el; } }
	};
	const win = {
		frameElement: frame,
		parent: { document: parentDoc, location: { pathname: '/santaba/uiv4/dashboards/dashboards-2338', hostname: 'acme.logicmonitor.com' }, LMGlobalData: { googleMapInfo: { key: 'K' } } },
		document: { cookie: '', getElementById: (id) => (id === 'tok' ? { innerText: ' abc ' } : id === 'ph' ? { innerText: '##x##' } : null), documentElement: { offsetHeight: 77 } }
	};
	win.parent.parent = win.parent;
	return { win, frame, container, styles };
}

test('context helpers resolve dashboard, widget, frame and parent elements', () => {
	const { win, frame, container } = makeFakeDom();
	const { lm } = makeLM(() => fakeResponse(200, {}), { window: win });
	assert.strictEqual(lm.context.dashboardId(), '2338');
	assert.strictEqual(lm.context.portal(), 'acme.logicmonitor.com');
	assert.ok(lm.context.isEmbedded());
	assert.strictEqual(lm.context.widgetFrame(), frame);
	assert.strictEqual(lm.context.widgetElement(), container);
	assert.strictEqual(lm.context.widgetId(), 'w1');
	assert.strictEqual(lm.context.widgetContainer(), container);
	assert.strictEqual(lm.context.widgetParent().id, 'cell');
	assert.strictEqual(lm.context.widgetTitle().id, 'title');
	assert.strictEqual(lm.context.globalData('googleMapInfo.key'), 'K');
	assert.strictEqual(lm.context.globalData('nope.x', 'fb'), 'fb');
	assert.strictEqual(lm.context.scopedKey('opts'), 'opts_2338_w1');
	assert.strictEqual(lm.context.getToken('tok'), 'abc');
	assert.strictEqual(lm.context.getToken('ph', 'none'), 'none');
});

test('context frame resize, parent style injection and no-parent behavior', () => {
	const { win, frame, styles } = makeFakeDom();
	const { lm } = makeLM(() => fakeResponse(200, {}), { window: win });
	assert.strictEqual(lm.context.contentHeight(), 77);
	assert.ok(lm.context.resizeFrame(77.4));
	assert.strictEqual(frame.style.height, '77px');
	assert.ok(!lm.context.resizeFrame(77));
	assert.ok(lm.context.injectParentStyle('s1', '.a{}'));
	assert.ok(lm.context.injectParentStyle('s1', '.b{}'));
	assert.strictEqual(styles.s1.textContent, '.a{}');
	const bare = makeLM(() => fakeResponse(200, {}), { window: { document: {}, location: { pathname: '/', hostname: 'h' } } }).lm;
	assert.ok(!bare.context.isEmbedded());
	assert.strictEqual(bare.context.widgetId(), null);
	assert.strictEqual(bare.context.dashboardId(), '');
});

test('cookie helpers round trip values', () => {
	const jar = {};
	const doc = {
		get cookie() { return Object.keys(jar).map((k) => k + '=' + jar[k]).join('; '); },
		set cookie(v) {
			const [pair, ...attrs] = v.split(';');
			const eq = pair.indexOf('=');
			if (attrs.some((a) => a === 'max-age=0')) delete jar[pair.slice(0, eq)];
			else jar[pair.slice(0, eq)] = pair.slice(eq + 1);
		}
	};
	const { lm } = makeLM(() => fakeResponse(200, {}), { window: { document: doc, location: { pathname: '/', hostname: 'h' } } });
	lm.context.setCookie('c', { a: 1, b: 'x y' });
	assert.deepStrictEqual(lm.context.getJsonCookie('c'), { a: 1, b: 'x y' });
	assert.strictEqual(lm.context.getCookie('missing'), null);
	lm.context.deleteCookie('c');
	assert.strictEqual(lm.context.getJsonCookie('c', 'dflt'), 'dflt');
});
