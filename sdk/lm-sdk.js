/**
 * lm-sdk.js - LogicMonitor custom dashboard widget SDK.
 *
 * Single file, no build step, ES2017, ASCII only (LogicMonitor's HTML sanitizer can corrupt
 * non-ASCII characters in widget scripts). Include it with a script tag and use the global "lm":
 *
 *   var devices = await lm.getDevices({ filter: { hostStatus: "normal" }, fields: "id,displayName" });
 *   lm.info("Loaded " + devices.length + " devices");
 *
 * Authentication is chosen automatically, in this order:
 *   1. Bearer token        (lm.configure({ bearerToken }))
 *   2. LMv1 API ID and key (lm.configure({ accessId, accessKey }))
 *   3. Integrated portal session with a CSRF token (default, no configuration needed)
 *
 * Logging note: lm.info/warn/error/debug always write to the browser console and can optionally
 * be forwarded to LM Logs through the log ingest endpoint (see the "logs" configuration).
 *
 * Portions of the auth and request logic were adapted from Better_Map_Widget.js (original
 * LMClient and CSRF token credit: Steven Villardi).
 */
(function (root) {
	'use strict';

	var VERSION = '1.0.0';
	var VALID_VERBS = ['GET', 'POST', 'PUT', 'PATCH'];
	var LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

	// Friendly resource names mapped to LogicMonitor REST paths. The trailing comments list the HTTP verbs the LogicMonitor REST v3 API
	// documents for each endpoint (collection and by-id forms). The SDK only sends GET, POST, PUT and PATCH (DELETE is intentionally not supported). The API enforces the rest based on the user's role permissions...
	var RESOURCES = {
		devices: '/device/devices', // GET (list/by id), POST (create), PUT/PATCH (update)...
		resources: '/device/devices', // GET (list/by id), POST (create), PUT/PATCH (update) (alias of devices)...
		deviceGroups: '/device/groups', // GET (list/by id), POST (create), PUT/PATCH (update)...
		resourceGroups: '/device/groups', // GET (list/by id), POST (create), PUT/PATCH (update) (alias of deviceGroups)...
		alerts: '/alert/alerts', // GET only (list/by id); acknowledge and notes are POST to sub-paths such as /{id}/ack and /{id}/note...
		websites: '/website/websites', // GET (list/by id), POST (create), PUT/PATCH (update)...
		websiteGroups: '/website/groups', // GET (list/by id), POST (create), PUT/PATCH (update)...
		collectors: '/setting/collector/collectors', // GET (list/by id), POST (create), PUT/PATCH (update)...
		collectorGroups: '/setting/collector/groups', // GET (list/by id), POST (create), PUT/PATCH (update)...
		dashboards: '/dashboard/dashboards', // GET (list/by id), POST (create), PUT/PATCH (update)...
		dashboardGroups: '/dashboard/groups', // GET (list/by id), POST (create), PUT/PATCH (update)...
		widgets: '/dashboard/widgets', // GET (list/by id), POST (create), PUT/PATCH (update)...
		sdts: '/sdt/sdts', // GET (list/by id), POST (create), PUT (update)...
		auditLogs: '/setting/accesslogs', // GET only (read-only)...
		datasources: '/setting/datasources', // GET (list/by id), POST (create), PUT/PATCH (update)...
		alertRules: '/setting/alert/rules', // GET (list/by id), POST (create), PUT/PATCH (update)...
		escalationChains: '/setting/alert/chains', // GET (list/by id), POST (create), PUT/PATCH (update)...
		integrations: '/setting/integrations', // GET (list/by id), POST (create), PUT/PATCH (update)...
		users: '/setting/admins', // GET (list/by id), POST (create), PUT/PATCH (update)...
		roles: '/setting/roles' // GET (list/by id), POST (create), PUT/PATCH (update)...
	};

	// Filter operators mapped to LogicMonitor filter syntax...
	var FILTER_OPERATORS = {
		'=': ':',
		'==': ':',
		':': ':',
		'!=': '!:',
		'!:': '!:',
		'>': '>',
		'>=': '>:',
		'>:': '>:',
		'<': '<',
		'<=': '<:',
		'<:': '<:',
		'~': '~',
		'contains': '~',
		'!~': '!~',
		'!contains': '!~'
	};

	/**
	 * Error type thrown by the SDK for API, network and usage problems.
	 *
	 * @class LMError
	 * @param {string} message - Error message.
	 * @param {object} [details] - Optional status, statusText, body, path, verb, code and cause.
	 */
	function LMError(message, details) {
		var err = Error.call(this, message);
		this.name = 'LMError';
		this.message = message;
		this.stack = err.stack;
		var d = details || {};
		this.status = d.status;
		this.statusText = d.statusText;
		this.body = d.body;
		this.path = d.path;
		this.verb = d.verb;
		this.code = d.code;
		this.cause = d.cause;
	}

	LMError.prototype = Object.create(Error.prototype);
	LMError.prototype.constructor = LMError;

	/**
	 * Returns true when a value is null, undefined, an empty string or an unresolved ##token## placeholder.
	 *
	 * @param {*} value - Value to test.
	 * @returns {boolean} True when the value is considered "nil".
	 */
	function isNil(value) {
		if (value === null || value === undefined) return true;
		if (typeof value === 'string') {
			var trimmed = value.trim();
			return trimmed === '' || /^##[^#]*##$/.test(trimmed);
		}
		return false;
	}

	/**
	 * Interprets common truthy token strings ("true", "yes", "1", "on", "y").
	 *
	 * @param {*} value - Value to test.
	 * @returns {boolean} True when the value reads as true.
	 */
	function isTruthy(value) {
		if (typeof value === 'boolean') return value;
		if (isNil(value)) return false;
		return /^(true|yes|y|1|on)$/i.test(String(value).trim());
	}

	/**
	 * Escapes a string for safe insertion as HTML text.
	 *
	 * @param {*} value - Value to escape.
	 * @returns {string} Escaped string.
	 */
	function escapeHtml(value) {
		return String(value === null || value === undefined ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/**
	 * Returns a debounced version of a function.
	 *
	 * @param {Function} fn - Function to debounce.
	 * @param {number} [delay=300] - Delay in milliseconds.
	 * @returns {Function} Debounced function with a cancel() method.
	 */
	function debounce(fn, delay) {
		var timeoutId = null;
		var wait = delay === undefined ? 300 : delay;
		var debounced = function () {
			var args = arguments;
			clearTimeout(timeoutId);
			timeoutId = setTimeout(function () { fn.apply(null, args); }, wait);
		};
		debounced.cancel = function () {
			clearTimeout(timeoutId);
			timeoutId = null;
		};
		return debounced;
	}

	/**
	 * Resolves after a delay, or rejects with an AbortError when the signal aborts.
	 *
	 * @param {number} ms - Milliseconds to wait.
	 * @param {AbortSignal} [signal] - Optional abort signal.
	 * @returns {Promise<void>} Promise resolving after the delay.
	 */
	function sleep(ms, signal) {
		return new Promise(function (resolve, reject) {
			if (signal && signal.aborted) {
				reject(makeAbortError());
				return;
			}
			var onAbort = function () {
				clearTimeout(timer);
				reject(makeAbortError());
			};
			var timer = setTimeout(function () {
				if (signal) signal.removeEventListener('abort', onAbort);
				resolve();
			}, ms);
			if (signal) signal.addEventListener('abort', onAbort, { once: true });
		});
	}

	/**
	 * Creates an error equivalent to fetch's AbortError.
	 *
	 * @returns {Error} Error named AbortError.
	 */
	function makeAbortError() {
		var e = new Error('The operation was aborted.');
		e.name = 'AbortError';
		return e;
	}

	/**
	 * Formats an epoch timestamp (seconds or milliseconds) as a local date/time string.
	 *
	 * @param {number|string} epoch - Epoch seconds or milliseconds.
	 * @returns {string} Formatted string, or an empty string for invalid input.
	 */
	function formatDate(epoch) {
		var n = Number(epoch);
		if (!isFinite(n) || n <= 0) return '';
		var ms = n < 1e12 ? n * 1000 : n;
		return new Date(ms).toLocaleString();
	}

	/**
	 * Builds a URL query string from a string or a plain object.
	 *
	 * @param {string|object} [query] - Query string (with or without ?) or key/value object.
	 * @returns {string} Query string beginning with ? or an empty string.
	 */
	function buildQueryString(query) {
		if (!query) return '';
		if (typeof query === 'string') {
			if (query === '') return '';
			return query.charAt(0) === '?' ? query : '?' + query;
		}
		var parts = [];
		Object.keys(query).forEach(function (key) {
			var value = query[key];
			if (value === undefined || value === null || value === '') return;
			parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
		});
		return parts.length ? '?' + parts.join('&') : '';
	}

	/**
	 * Formats a value for use on the right side of a LogicMonitor filter term.
	 *
	 * @param {*} value - Value to format.
	 * @returns {string} Filter literal (numbers and booleans bare, strings double quoted).
	 */
	function formatFilterValue(value) {
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
	}

	/**
	 * Redacts sensitive values (tokens, keys, passwords) from log metadata.
	 *
	 * @param {*} value - Value to scrub.
	 * @param {number} [depth=0] - Current recursion depth.
	 * @returns {*} Scrubbed copy.
	 */
	function redact(value, depth) {
		var level = depth || 0;
		if (value === null || value === undefined) return value;
		if (typeof value === 'string') {
			return value.replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1[REDACTED]')
				.replace(/(LMv1\s+)[^\s]+/gi, '$1[REDACTED]');
		}
		if (typeof value !== 'object') return value;
		if (level > 4) return '[Object]';
		if (value instanceof Error) {
			return { name: value.name, message: redact(value.message, level + 1), status: value.status };
		}
		if (Array.isArray(value)) return value.map(function (v) { return redact(v, level + 1); });
		var out = {};
		Object.keys(value).forEach(function (key) {
			if (/token|secret|password|authorization|accesskey|apikey|api_key|bearer/i.test(key)) {
				out[key] = '[REDACTED]';
			} else {
				out[key] = redact(value[key], level + 1);
			}
		});
		return out;
	}

	/**
	 * Converts any log message input into a string.
	 *
	 * @param {*} message - Message, Error or object.
	 * @returns {string} Message text.
	 */
	function messageToString(message) {
		if (typeof message === 'string') return message;
		if (message instanceof Error) return message.name + ': ' + message.message;
		try {
			return JSON.stringify(message);
		} catch (e) {
			return String(message);
		}
	}

	/**
	 * Creates a new, independent SDK instance. Each instance owns its own configuration, token
	 * cache, logger and queues, so several widgets never share state.
	 *
	 * @param {object} [initialConfig] - Initial configuration (see configure()).
	 * @returns {object} The SDK instance.
	 */
	function createLM(initialConfig) {
		var cfg = {
			bearerToken: '',
			accessId: '',
			accessKey: '',
			apiVersion: '3',
			restBase: '/santaba/rest',
			widgetName: 'widget',
			logLevel: 'info',
			csrfTtlMs: 5 * 60 * 1000,
			retry: { max: 2, baseMs: 500 },
			fetch: function () { return root.fetch.apply(root, arguments); },
			now: function () { return Date.now(); },
			logs: {
				enabled: false,
				endpoint: '/rest/log/ingest',
				signPath: '/log/ingest',
				resourceId: null,
				batchSize: 50,
				flushMs: 5000,
				maxQueue: 1000
			}
		};

		var csrfToken = null;
		var csrfExpiry = 0;
		var csrfPromise = null;
		var transports = [];
		var logQueue = [];
		var logTimer = null;
		var logFlushing = false;
		var logFailureWarned = false;
		var lifecycleHooked = false;

		var lm = { version: VERSION, LMError: LMError };

		// ------------------------------------------------------------
		// Configuration and authentication...

		/**
		 * Updates the SDK configuration. Unknown keys are ignored. Placeholder values such as
		 * ##apiKey## are treated as not set.
		 *
		 * @param {object} options - bearerToken, accessId, accessKey, apiVersion, restBase,
		 *   widgetName, logLevel, retry ({max, baseMs}), csrfTtlMs, fetch, logs (see README).
		 * @returns {object} The SDK instance for chaining.
		 */
		lm.configure = function (options) {
			var o = options || {};
			['bearerToken', 'accessId', 'accessKey'].forEach(function (key) {
				if (o[key] !== undefined) cfg[key] = isNil(o[key]) ? '' : String(o[key]).trim();
			});
			['apiVersion', 'restBase', 'widgetName', 'csrfTtlMs', 'fetch', 'now', 'window'].forEach(function (key) {
				if (o[key] !== undefined && !isNil(o[key])) cfg[key] = o[key];
			});
			if (o.logLevel !== undefined) lm.setLevel(o.logLevel);
			if (o.retry) {
				if (o.retry.max !== undefined) cfg.retry.max = o.retry.max;
				if (o.retry.baseMs !== undefined) cfg.retry.baseMs = o.retry.baseMs;
			}
			if (o.logs) {
				Object.keys(o.logs).forEach(function (key) { cfg.logs[key] = o.logs[key]; });
				if (cfg.logs.enabled) hookLifecycle();
			}
			if (o.bearerToken !== undefined || o.accessId !== undefined || o.accessKey !== undefined) {
				csrfToken = null;
				csrfExpiry = 0;
			}
			return lm;
		};

		lm.auth = {};

		/**
		 * Returns the active authentication mode.
		 *
		 * @returns {'bearer'|'lmv1'|'session'} Active mode.
		 */
		lm.auth.mode = function () {
			if (cfg.bearerToken) return 'bearer';
			if (cfg.accessId && cfg.accessKey) return 'lmv1';
			return 'session';
		};

		/**
		 * Reads credentials from hidden widget token elements and applies them. Unresolved
		 * ##token## placeholders are ignored, so the integrated session is used when no
		 * credentials were supplied in the widget configuration.
		 *
		 * @param {object} [elementIds] - Element ids: bearerToken, accessId, accessKey.
		 * @returns {string} The resulting auth mode.
		 */
		lm.auth.fromTokens = function (elementIds) {
			var ids = elementIds || {};
			lm.configure({
				bearerToken: lm.context.getToken(ids.bearerToken || 'apiBearerTokenToken') || '',
				accessId: lm.context.getToken(ids.accessId || 'apiIDToken') || '',
				accessKey: lm.context.getToken(ids.accessKey || 'apiKeyToken') || ''
			});
			return lm.auth.mode();
		};

		/**
		 * Fetches (and caches) a CSRF token for session auth. Concurrent callers share one request.
		 *
		 * @param {boolean} [forceRefresh=false] - Bypass the cache.
		 * @returns {Promise<string>} The CSRF token.
		 */
		lm.auth.getCsrfToken = function (forceRefresh) {
			if (!forceRefresh && csrfToken && cfg.now() < csrfExpiry) return Promise.resolve(csrfToken);
			if (csrfPromise) return csrfPromise;
			csrfPromise = (async function () {
				try {
					var response = await cfg.fetch(cfg.restBase + '/functions/dummy', {
						method: 'GET',
						headers: { 'X-Csrf-Token': 'Fetch', 'Accept': 'application/json', 'X-Version': '3' },
						credentials: 'include'
					});
					if (!response.ok) {
						throw new LMError('Failed to fetch CSRF token: ' + response.status + ' ' + response.statusText,
							{ status: response.status, statusText: response.statusText, path: '/functions/dummy', verb: 'GET' });
					}
					var token = response.headers.get('X-Csrf-Token');
					if (!token) throw new LMError('CSRF token not found in response headers.', { path: '/functions/dummy' });
					csrfToken = token;
					csrfExpiry = cfg.now() + cfg.csrfTtlMs;
					return token;
				} catch (e) {
					csrfToken = null;
					csrfExpiry = 0;
					throw e;
				} finally {
					csrfPromise = null;
				}
			})();
			return csrfPromise;
		};

		/**
		 * Builds an LMv1 Authorization header. The signature is the base64 encoding of the
		 * hex-encoded HMAC-SHA256 of (verb + epoch + body + resourcePath), as LogicMonitor requires.
		 *
		 * @param {string} verb - HTTP verb.
		 * @param {string} resourcePath - Resource path without the base or query string.
		 * @param {object|Array} [body] - Request body for POST/PUT/PATCH.
		 * @param {number} [epoch] - Timestamp in ms (defaults to now).
		 * @returns {Promise<string>} The Authorization header value.
		 */
		lm.auth.signLMv1 = async function (verb, resourcePath, body, epoch) {
			var ts = epoch === undefined ? cfg.now() : epoch;
			var data = (body !== undefined && body !== null && ['POST', 'PUT', 'PATCH'].indexOf(verb) !== -1)
				? (typeof body === 'string' ? body : JSON.stringify(body))
				: '';
			var encoder = new TextEncoder();
			var subtle = (root.crypto || globalThis.crypto).subtle;
			var key = await subtle.importKey('raw', encoder.encode(cfg.accessKey),
				{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
			var sig = await subtle.sign('HMAC', key, encoder.encode(verb + ts + data + resourcePath));
			var hex = Array.prototype.map.call(new Uint8Array(sig), function (b) {
				return ('0' + b.toString(16)).slice(-2);
			}).join('');
			return 'LMv1 ' + cfg.accessId + ':' + btoa(hex) + ':' + ts;
		};

		/**
		 * Applies the active authentication to a request's headers and init object.
		 *
		 * @param {object} headers - Headers object to mutate.
		 * @param {object} init - Fetch init object to mutate.
		 * @param {string} verb - HTTP verb.
		 * @param {string} signPath - Path used for LMv1 signing.
		 * @param {*} body - Request body.
		 * @returns {Promise<void>} Resolves when headers are set.
		 */
		async function applyAuth(headers, init, verb, signPath, body) {
			var mode = lm.auth.mode();
			if (mode === 'bearer') {
				headers.Authorization = 'Bearer ' + cfg.bearerToken;
			} else if (mode === 'lmv1') {
				headers.Authorization = await lm.auth.signLMv1(verb, signPath, body);
			} else {
				headers['X-Csrf-Token'] = await lm.auth.getCsrfToken();
				init.credentials = 'include';
			}
		}

		// ------------------------------------------------------------
		// Low level client...

		lm.client = {};

		/**
		 * Performs a request against the LogicMonitor REST API.
		 *
		 * @async
		 * @param {object} opts - Request options.
		 * @param {string} opts.path - Resource path, for example /device/devices.
		 * @param {string} [opts.verb='GET'] - GET, POST, PUT or PATCH.
		 * @param {string|object} [opts.query] - Query string or key/value object.
		 * @param {object|Array} [opts.body] - JSON body for POST/PUT/PATCH.
		 * @param {string} [opts.version] - API version (default from configuration, normally 3).
		 * @param {AbortSignal} [opts.signal] - Optional abort signal.
		 * @param {string} [opts.base] - Override the REST base (for example /rest for log ingest).
		 * @param {boolean} [opts.retry=true] - Set false to disable retries.
		 * @returns {Promise<object>} Parsed JSON response (an empty object for 204 or empty bodies).
		 * @throws {LMError} On API errors (status >= 300), network failures or bad JSON.
		 */
		lm.client.request = async function (opts) {
			var o = opts || {};
			if (!o.path) throw new LMError('Missing required parameter: path.');
			var verb = String(o.verb || 'GET').toUpperCase();
			if (VALID_VERBS.indexOf(verb) === -1) {
				throw new LMError('Invalid verb: ' + verb + '. Must be one of ' + VALID_VERBS.join(', '));
			}
			var path = o.path.charAt(0) === '/' ? o.path : '/' + o.path;
			var base = o.base !== undefined ? o.base : cfg.restBase;
			var url = base + path + buildQueryString(o.query);
			var hasBody = o.body !== undefined && o.body !== null && ['POST', 'PUT', 'PATCH'].indexOf(verb) !== -1;
			var bodyText = null;
			if (hasBody) {
				try {
					bodyText = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
				} catch (stringifyError) {
					throw new LMError('Invalid body provided. Could not stringify to JSON: ' + stringifyError.message,
						{ path: path, verb: verb, cause: stringifyError });
				}
			}
			var retryEnabled = o.retry !== false;
			var maxRetries = retryEnabled ? cfg.retry.max : 0;
			var attempt = 0;
			var csrfRetried = false;

			while (true) {
				attempt++;
				var headers = { 'Accept': 'application/json', 'X-Version': o.version || cfg.apiVersion };
				if (hasBody) headers['Content-Type'] = 'application/json';
				var init = { method: verb, headers: headers };
				if (o.signal) init.signal = o.signal;
				if (hasBody) init.body = bodyText;
				await applyAuth(headers, init, verb, path, hasBody ? bodyText : undefined);

				var response;
				try {
					response = await cfg.fetch(url, init);
				} catch (netError) {
					if (netError && netError.name === 'AbortError') throw netError;
					if (verb === 'GET' && attempt <= maxRetries) {
						await sleep(cfg.retry.baseMs * Math.pow(2, attempt - 1), o.signal);
						continue;
					}
					throw new LMError('Network error calling ' + verb + ' ' + path + ': ' + (netError && netError.message),
						{ path: path, verb: verb, cause: netError });
				}

				if (response.ok) return parseResponse(response, path, verb);

				if ((response.status === 401 || response.status === 403) && lm.auth.mode() === 'session' && !csrfRetried) {
					csrfRetried = true;
					csrfToken = null;
					csrfExpiry = 0;
					attempt--;
					continue;
				}
				if (response.status === 429 && attempt <= maxRetries) {
					var windowSeconds = Number(response.headers && response.headers.get && response.headers.get('X-Rate-Limit-Window'));
					var waitMs = windowSeconds > 0 && windowSeconds <= 60
						? windowSeconds * 1000
						: cfg.retry.baseMs * Math.pow(2, attempt - 1);
					await sleep(waitMs, o.signal);
					continue;
				}
				if (verb === 'GET' && [502, 503, 504].indexOf(response.status) !== -1 && attempt <= maxRetries) {
					await sleep(cfg.retry.baseMs * Math.pow(2, attempt - 1), o.signal);
					continue;
				}
				throw await buildHttpError(response, path, verb);
			}
		};

		/**
		 * Parses a successful response body.
		 *
		 * @async
		 * @param {Response} response - Fetch response.
		 * @param {string} path - Request path.
		 * @param {string} verb - HTTP verb.
		 * @returns {Promise<object>} Parsed JSON or an empty object.
		 */
		async function parseResponse(response, path, verb) {
			if (response.status === 204) return {};
			var text = await response.text();
			if (!text) return {};
			try {
				return JSON.parse(text);
			} catch (jsonError) {
				throw new LMError('Received response (' + response.status + ') but failed to parse JSON: ' + jsonError.message,
					{ status: response.status, statusText: response.statusText, path: path, verb: verb, body: text.slice(0, 500), cause: jsonError });
			}
		}

		/**
		 * Builds an LMError from a non-OK response.
		 *
		 * @async
		 * @param {Response} response - Fetch response.
		 * @param {string} path - Request path.
		 * @param {string} verb - HTTP verb.
		 * @returns {Promise<LMError>} The error to throw.
		 */
		async function buildHttpError(response, path, verb) {
			var bodyText = '';
			try {
				bodyText = await response.text();
			} catch (e) {
				bodyText = '';
			}
			var detail = '';
			var code;
			try {
				var parsed = JSON.parse(bodyText);
				detail = parsed.errorMessage || parsed.errmsg || parsed.message || '';
				code = parsed.errorCode;
			} catch (e) {
				detail = '';
			}
			var message = 'API Error: ' + response.status + ' ' + response.statusText + (detail ? ' - ' + detail : '');
			return new LMError(message, {
				status: response.status, statusText: response.statusText,
				body: bodyText || 'No additional error details provided.', path: path, verb: verb, code: code
			});
		}

		/**
		 * Performs a single GET request.
		 *
		 * @param {string} path - Resource path.
		 * @param {string|object} [query] - Query string or object.
		 * @param {object} [opts] - Extra request options (signal, version, retry).
		 * @returns {Promise<object>} Parsed JSON response.
		 */
		lm.get = function (path, query, opts) {
			var o = opts || {};
			return lm.client.request({ path: path, verb: 'GET', query: query, version: o.version, signal: o.signal, retry: o.retry });
		};

		/**
		 * Fetches every page of a list endpoint. Handles totals reported as negative numbers
		 * (alerts) and guards against empty pages so it can never loop forever.
		 *
		 * @async
		 * @param {string} path - Resource path.
		 * @param {object} [opts] - filter (string), fields (string), sort (string), size (default 1000),
		 *   maxItems, onProgress(loaded, total), signal, params (extra query parameters).
		 * @returns {Promise<{items: Array, total: number}>} All items and the reported total.
		 */
		lm.getAll = async function (path, opts) {
			var o = opts || {};
			var size = o.size || 1000;
			var items = [];
			var total = Infinity;
			var offset = 0;
			while (offset < total) {
				var params = {};
				Object.keys(o.params || {}).forEach(function (k) { params[k] = o.params[k]; });
				params.size = size;
				params.offset = offset;
				if (o.fields) params.fields = o.fields;
				if (o.filter) params.filter = o.filter;
				if (o.sort) params.sort = o.sort;
				var data = await lm.client.request({ path: path, verb: 'GET', query: params, signal: o.signal });
				var page = Array.isArray(data.items) ? data.items : [];
				if (typeof data.total === 'number' && data.total >= 0) {
					total = data.total;
				} else if (page.length < size) {
					total = items.length + page.length;
				}
				if (!page.length) {
					if (total !== Infinity && total > items.length && offset > 0) {
						lm.warn('getAll stopped at ' + items.length + ' of ' + total + ' after an empty page (' + path + ').');
					}
					total = Math.min(total, items.length);
					break;
				}
				items.push.apply(items, page);
				offset = items.length;
				if (typeof o.onProgress === 'function') {
					try { o.onProgress(items.length, total === Infinity ? undefined : total); } catch (cbError) { /* ignore callback errors... */ }
				}
				if (o.maxItems && items.length >= o.maxItems) {
					items = items.slice(0, o.maxItems);
					break;
				}
			}
			return { items: items, total: total === Infinity ? items.length : total };
		};

		// ------------------------------------------------------------
		// Fluent query builder (GlideRecord style)...

		/**
		 * Fluent query builder for list endpoints.
		 *
		 * @class LMQuery
		 * @param {string} resource - Friendly resource name (for example "devices") or a path starting with /.
		 */
		function LMQuery(resource) {
			var path = RESOURCES[resource] || (typeof resource === 'string' && resource.charAt(0) === '/' ? resource : null);
			if (!path) {
				throw new LMError('Unknown resource "' + resource + '". Use one of: ' + Object.keys(RESOURCES).join(', ') + ' or a path beginning with /.');
			}
			this._path = path;
			this._terms = [];
			this._fields = '';
			this._sort = '';
			this._size = 1000;
			this._max = 0;
			this._params = {};
			this._signal = null;
			this._onProgress = null;
		}

		/**
		 * Adds an AND condition. With two arguments the operator is equals.
		 *
		 * @param {string} field - Field name.
		 * @param {string|*} operatorOrValue - Operator (=, !=, >, >=, <, <=, ~, !~, contains) or the value.
		 * @param {*} [value] - Value when an operator is supplied.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.addQuery = function (field, operatorOrValue, value) {
			return this._addTerm(',', field, operatorOrValue, value, arguments.length);
		};

		/**
		 * Adds an OR condition joined to the previous condition (LogicMonitor "||").
		 *
		 * @param {string} field - Field name.
		 * @param {string|*} operatorOrValue - Operator or value.
		 * @param {*} [value] - Value when an operator is supplied.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.addOrQuery = function (field, operatorOrValue, value) {
			return this._addTerm('||', field, operatorOrValue, value, arguments.length);
		};

		/**
		 * Internal: appends a filter term.
		 *
		 * @param {string} join - "," for AND or "||" for OR.
		 * @param {string} field - Field name.
		 * @param {*} operatorOrValue - Operator or value.
		 * @param {*} value - Value when an operator was supplied.
		 * @param {number} argCount - Number of arguments originally passed.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype._addTerm = function (join, field, operatorOrValue, value, argCount) {
			var op = ':';
			var val = operatorOrValue;
			if (argCount >= 3) {
				op = FILTER_OPERATORS[String(operatorOrValue).toLowerCase()];
				if (!op) throw new LMError('Unsupported filter operator: ' + operatorOrValue);
				val = value;
			}
			this._terms.push({ join: join, text: field + op + formatFilterValue(val) });
			return this;
		};

		/**
		 * Adds a raw LogicMonitor filter expression as an AND condition.
		 *
		 * @param {string} filter - Raw filter text.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.addRawFilter = function (filter) {
			if (filter) this._terms.push({ join: ',', text: String(filter) });
			return this;
		};

		/**
		 * Sets the fields to return.
		 *
		 * @param {string|Array<string>} list - Comma separated string or array of field names.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.fields = function (list) {
			this._fields = Array.isArray(list) ? list.join(',') : String(list || '');
			return this;
		};

		/**
		 * Sorts ascending by a field.
		 *
		 * @param {string} field - Field name.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.orderBy = function (field) {
			this._sort = '+' + field;
			return this;
		};

		/**
		 * Sorts descending by a field.
		 *
		 * @param {string} field - Field name.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.orderByDesc = function (field) {
			this._sort = '-' + field;
			return this;
		};

		/**
		 * Limits the total number of items returned.
		 *
		 * @param {number} n - Maximum item count.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.limit = function (n) {
			this._max = Number(n) || 0;
			if (this._max > 0 && this._max < this._size) this._size = this._max;
			return this;
		};

		/**
		 * Sets the page size used for requests (maximum 1000).
		 *
		 * @param {number} n - Page size.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.pageSize = function (n) {
			this._size = Math.max(1, Math.min(1000, Number(n) || 1000));
			return this;
		};

		/**
		 * Adds an extra query parameter (for example "format" or "start").
		 *
		 * @param {string} key - Parameter name.
		 * @param {*} value - Parameter value.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.param = function (key, value) {
			this._params[key] = value;
			return this;
		};

		/**
		 * Attaches an abort signal.
		 *
		 * @param {AbortSignal} signal - Abort signal.
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.signal = function (signal) {
			this._signal = signal;
			return this;
		};

		/**
		 * Attaches a progress callback used by getAll().
		 *
		 * @param {Function} fn - Called with (loaded, total).
		 * @returns {LMQuery} This query.
		 */
		LMQuery.prototype.onProgress = function (fn) {
			this._onProgress = fn;
			return this;
		};

		/**
		 * Returns the assembled filter expression.
		 *
		 * @returns {string} Filter text (empty when there are no conditions).
		 */
		LMQuery.prototype.getFilter = function () {
			var out = '';
			this._terms.forEach(function (term, i) {
				out += (i === 0 ? '' : term.join) + term.text;
			});
			return out;
		};

		/**
		 * Returns the assembled query parameters for a given offset.
		 *
		 * @param {number} [offset=0] - Page offset.
		 * @returns {object} Parameter object.
		 */
		LMQuery.prototype.getParams = function (offset) {
			var params = {};
			var self = this;
			Object.keys(this._params).forEach(function (k) { params[k] = self._params[k]; });
			params.size = this._size;
			params.offset = offset || 0;
			if (this._fields) params.fields = this._fields;
			if (this._sort) params.sort = this._sort;
			var filter = this.getFilter();
			if (filter) params.filter = filter;
			return params;
		};

		/**
		 * Fetches a single page.
		 *
		 * @param {number} [offset=0] - Page offset.
		 * @returns {Promise<{items: Array, total: number}>} The page.
		 */
		LMQuery.prototype.get = async function (offset) {
			var data = await lm.client.request({ path: this._path, query: this.getParams(offset), signal: this._signal });
			return { items: Array.isArray(data.items) ? data.items : [], total: data.total };
		};

		/**
		 * Fetches all pages.
		 *
		 * @returns {Promise<{items: Array, total: number}>} Items and total.
		 */
		LMQuery.prototype.getAll = function () {
			return lm.getAll(this._path, {
				filter: this.getFilter(), fields: this._fields, sort: this._sort, size: this._size,
				maxItems: this._max, onProgress: this._onProgress, signal: this._signal, params: this._params
			});
		};

		/**
		 * Fetches all pages and returns just the item array.
		 *
		 * @async
		 * @returns {Promise<Array>} Items.
		 */
		LMQuery.prototype.getItems = async function () {
			return (await this.getAll()).items;
		};

		/**
		 * Fetches the first matching item.
		 *
		 * @async
		 * @returns {Promise<object|null>} First item or null.
		 */
		LMQuery.prototype.first = async function () {
			var saved = this._size;
			this._size = 1;
			try {
				var page = await this.get(0);
				return page.items.length ? page.items[0] : null;
			} finally {
				this._size = saved;
			}
		};

		/**
		 * Fetches one item by id.
		 *
		 * @param {string|number} id - Item id.
		 * @returns {Promise<object>} The item.
		 */
		LMQuery.prototype.getById = function (id) {
			var query = this._fields ? { fields: this._fields } : undefined;
			return lm.client.request({ path: this._path + '/' + encodeURIComponent(id), query: query, signal: this._signal });
		};

		/**
		 * Counts matching items. Falls back to paging when the API reports no total.
		 *
		 * @async
		 * @returns {Promise<number>} Count.
		 */
		LMQuery.prototype.count = async function () {
			var saved = this._size;
			this._size = 1;
			var page;
			try {
				page = await this.get(0);
			} finally {
				this._size = saved;
			}
			if (typeof page.total === 'number' && page.total >= 0) return page.total;
			this._size = 1000;
			var all = await this.fields('id').getAll();
			this._size = saved;
			return all.items.length;
		};

		/**
		 * Starts a fluent query.
		 *
		 * @param {string} resource - Friendly resource name or path.
		 * @returns {LMQuery} A new query.
		 */
		lm.query = function (resource) {
			return new LMQuery(resource);
		};

		lm.LMQuery = LMQuery;

		// ------------------------------------------------------------
		// Resource shortcuts...

		/**
		 * Applies shortcut options (filter, fields, sort, size, maxItems, onProgress, signal) to a query.
		 * A filter may be a raw string, an object of field/value equality pairs, or an array of
		 * [field, operator, value] triples.
		 *
		 * @param {LMQuery} q - Query to configure.
		 * @param {object} [opts] - Shortcut options.
		 * @returns {LMQuery} The configured query.
		 */
		function applyOptions(q, opts) {
			var o = opts || {};
			var f = o.filter;
			if (typeof f === 'string') {
				q.addRawFilter(f);
			} else if (Array.isArray(f)) {
				f.forEach(function (t) { q.addQuery(t[0], t[1], t[2]); });
			} else if (f && typeof f === 'object') {
				Object.keys(f).forEach(function (k) { q.addQuery(k, f[k]); });
			}
			if (o.fields) q.fields(o.fields);
			if (o.sort) q._sort = o.sort;
			if (o.size) q.pageSize(o.size);
			if (o.maxItems) q.limit(o.maxItems);
			if (o.onProgress) q.onProgress(o.onProgress);
			if (o.signal) q.signal(o.signal);
			return q;
		}

		/**
		 * Defines a shortcut that returns all items for a resource.
		 *
		 * @param {string} name - Method name on lm.
		 * @param {string} resource - Resource key.
		 */
		function defineListShortcut(name, resource) {
			lm[name] = function (opts) {
				return applyOptions(lm.query(resource), opts).getItems();
			};
		}

		/**
		 * Defines a shortcut that returns one item by id.
		 *
		 * @param {string} name - Method name on lm.
		 * @param {string} resource - Resource key.
		 */
		function defineByIdShortcut(name, resource) {
			lm[name] = function (id, opts) {
				return applyOptions(lm.query(resource), opts).getById(id);
			};
		}

		defineListShortcut('getDevices', 'devices');
		defineListShortcut('getDeviceGroups', 'deviceGroups');
		defineListShortcut('getAlerts', 'alerts');
		defineListShortcut('getWebsites', 'websites');
		defineListShortcut('getWebsiteGroups', 'websiteGroups');
		defineListShortcut('getCollectors', 'collectors');
		defineListShortcut('getCollectorGroups', 'collectorGroups');
		defineListShortcut('getDashboards', 'dashboards');
		defineListShortcut('getDashboardGroups', 'dashboardGroups');
		defineListShortcut('getWidgets', 'widgets');
		defineListShortcut('getSDTs', 'sdts');
		defineListShortcut('getAuditLogs', 'auditLogs');
		defineListShortcut('getDatasources', 'datasources');
		defineListShortcut('getAlertRules', 'alertRules');
		defineListShortcut('getEscalationChains', 'escalationChains');
		defineListShortcut('getIntegrations', 'integrations');
		defineByIdShortcut('getDevice', 'devices');
		defineByIdShortcut('getDeviceGroup', 'deviceGroups');
		defineByIdShortcut('getAlert', 'alerts');
		defineByIdShortcut('getWebsite', 'websites');
		defineByIdShortcut('getCollector', 'collectors');
		defineByIdShortcut('getDashboard', 'dashboards');
		defineByIdShortcut('getWidget', 'widgets');
		defineByIdShortcut('getDatasource', 'datasources');

		/**
		 * Defines a shortcut returning all items of a sub-collection beneath a parent path.
		 *
		 * @param {string} name - Method name on lm.
		 * @param {Function} pathBuilder - Builds the collection path from the shortcut arguments.
		 * @param {number} argCount - Number of leading path arguments.
		 */
		function defineSubListShortcut(name, pathBuilder, argCount) {
			lm[name] = function () {
				var args = Array.prototype.slice.call(arguments, 0, argCount);
				var opts = arguments[argCount];
				var q = applyOptions(new LMQuery(pathBuilder.apply(null, args)), opts);
				return q.getItems();
			};
		}

		defineSubListShortcut('getDeviceDataSources', function (deviceId) {
			return '/device/devices/' + encodeURIComponent(deviceId) + '/devicedatasources';
		}, 1);
		defineSubListShortcut('getDeviceInstances', function (deviceId, deviceDataSourceId) {
			return '/device/devices/' + encodeURIComponent(deviceId) + '/devicedatasources/' +
				encodeURIComponent(deviceDataSourceId) + '/instances';
		}, 2);
		defineSubListShortcut('getProperties', function (deviceId) {
			return '/device/devices/' + encodeURIComponent(deviceId) + '/properties';
		}, 1);
		defineSubListShortcut('getDeviceGroupDevices', function (groupId) {
			return '/device/groups/' + encodeURIComponent(groupId) + '/devices';
		}, 1);
		defineSubListShortcut('getDashboardWidgets', function (dashboardId) {
			return '/dashboard/dashboards/' + encodeURIComponent(dashboardId) + '/widgets';
		}, 1);

		/**
		 * Gets time series data for an instance.
		 *
		 * @param {string|number} deviceId - Device id.
		 * @param {string|number} deviceDataSourceId - Device DataSource id.
		 * @param {string|number} instanceId - Instance id.
		 * @param {object} [opts] - start and end (epoch seconds), signal.
		 * @returns {Promise<object>} Instance data (dataPoints, time, values).
		 */
		lm.getInstanceData = function (deviceId, deviceDataSourceId, instanceId, opts) {
			var o = opts || {};
			return lm.client.request({
				path: '/device/devices/' + encodeURIComponent(deviceId) + '/devicedatasources/' + encodeURIComponent(deviceDataSourceId) +
					'/instances/' + encodeURIComponent(instanceId) + '/data',
				query: { start: o.start, end: o.end, datapoints: o.datapoints },
				signal: o.signal
			});
		};

		/**
		 * Gets graph data for an instance graph.
		 *
		 * @param {string|number} deviceId - Device id.
		 * @param {string|number} deviceDataSourceId - Device DataSource id.
		 * @param {string|number} instanceId - Instance id.
		 * @param {string|number} graphId - Graph id.
		 * @param {object} [opts] - start and end (epoch seconds), signal.
		 * @returns {Promise<object>} Graph data.
		 */
		lm.getGraphData = function (deviceId, deviceDataSourceId, instanceId, graphId, opts) {
			var o = opts || {};
			return lm.client.request({
				path: '/device/devices/' + encodeURIComponent(deviceId) + '/devicedatasources/' + encodeURIComponent(deviceDataSourceId) +
					'/instances/' + encodeURIComponent(instanceId) + '/graphs/' + encodeURIComponent(graphId) + '/data',
				query: { start: o.start, end: o.end },
				signal: o.signal
			});
		};

		/**
		 * Gets the data for a dashboard widget.
		 *
		 * @param {string|number} widgetId - Widget id.
		 * @param {object} [opts] - start and end (epoch seconds), signal.
		 * @returns {Promise<object>} Widget data.
		 */
		lm.getWidgetData = function (widgetId, opts) {
			var o = opts || {};
			return lm.client.request({
				path: '/dashboard/widgets/' + encodeURIComponent(widgetId) + '/data',
				query: { start: o.start, end: o.end },
				signal: o.signal
			});
		};

		/**
		 * Looks up a property value on a device object (custom, system, auto, then inherited).
		 *
		 * @param {object} device - Device returned by the API.
		 * @param {string} name - Property name.
		 * @param {*} [fallback] - Value when the property is absent.
		 * @returns {*} Property value or the fallback.
		 */
		lm.getProperty = function (device, name, fallback) {
			if (!device) return fallback;
			var lists = ['customProperties', 'systemProperties', 'autoProperties', 'inheritedProperties'];
			for (var i = 0; i < lists.length; i++) {
				var list = device[lists[i]];
				if (!Array.isArray(list)) continue;
				for (var j = 0; j < list.length; j++) {
					if (list[j] && list[j].name === name) return list[j].value;
				}
			}
			return fallback;
		};

		// ------------------------------------------------------------
		// Context helpers...

		lm.context = {};

		/**
		 * Returns the window used for reading portal context (the parent when embedded).
		 *
		 * @returns {object|null} A window, or null when unavailable.
		 */
		function contextWindow() {
			var w = W();
			try {
				if (w.parent && w.parent.location && w.parent.location.pathname !== undefined) return w.parent;
			} catch (e) {
				/* cross-origin parent... */
			}
			return w.location ? w : null;
		}

		/**
		 * Returns the window the SDK reads context from (the real window unless overridden for tests).
		 *
		 * @returns {object} A window-like object.
		 */
		function W() {
			return cfg.window || root;
		}

		// Selectors for LogicMonitor's generated dashboard markup. If a portal update breaks the
		// widget helpers, these are the first things to check (override with lm.context.selectors)...
		lm.context.selectors = {
			widget: 'div[id][class*="DashboardWidgetsGrid__StyledWidget"]',
			title: 'p.MuiTypography-root'
		};

		/**
		 * Returns the numeric id of the dashboard hosting the widget.
		 *
		 * @returns {string} Dashboard id or an empty string.
		 */
		lm.context.dashboardId = function () {
			var w = contextWindow();
			var m = w && w.location.pathname.match(/\/dashboards-(\d+)/i);
			return m ? m[1] : '';
		};

		/**
		 * Returns the id of the DOM element of the LogicMonitor widget containing this iframe.
		 *
		 * @returns {string|null} Widget element id or null.
		 */
		lm.context.widgetId = function () {
			var el = lm.context.widgetElement();
			return el ? el.id : null;
		};

		/**
		 * Returns true when this script runs inside an iframe whose parent page is readable.
		 *
		 * @returns {boolean} True when embedded in a same-origin parent.
		 */
		lm.context.isEmbedded = function () {
			var w = W();
			try {
				return !!(w.parent && w.parent !== w && w.parent.document);
			} catch (e) {
				return false;
			}
		};

		/**
		 * Returns the parent page's document (the dashboard), or null when not embedded or blocked.
		 *
		 * @returns {Document|null} Parent document.
		 */
		lm.context.parentDocument = function () {
			return lm.context.isEmbedded() ? W().parent.document : null;
		};

		/**
		 * Returns the iframe element that hosts this widget script. Uses window.frameElement and
		 * falls back to searching the parent document for the iframe whose contentWindow is this window.
		 *
		 * @returns {HTMLIFrameElement|null} The iframe, or null when unavailable.
		 */
		lm.context.widgetFrame = function () {
			var w = W();
			try {
				if (w.frameElement) return w.frameElement;
				var doc = lm.context.parentDocument();
				if (!doc) return null;
				var frames = Array.prototype.slice.call(doc.querySelectorAll('iframe'));
				return frames.filter(function (f) { return f.contentWindow === w; })[0] || null;
			} catch (e) {
				return null;
			}
		};

		/**
		 * Returns the nearest element with an id that contains the widget iframe (the element
		 * whose id is the widget id).
		 *
		 * @returns {Element|null} The element or null.
		 */
		lm.context.widgetElement = function () {
			var frame = lm.context.widgetFrame();
			return (frame && frame.closest('[id]')) || null;
		};

		/**
		 * Returns the outer styled widget container (card) in the parent page, which is the
		 * element to style for effects such as hiding a widget's background. Falls back to the
		 * widget element when the selector no longer matches.
		 *
		 * @returns {Element|null} The container or null.
		 */
		lm.context.widgetContainer = function () {
			var el = lm.context.widgetElement();
			if (!el) return null;
			try {
				return el.closest(lm.context.selectors.widget) || el;
			} catch (e) {
				return el;
			}
		};

		/**
		 * Returns the widget's title element in the parent page.
		 *
		 * @returns {Element|null} The title element or null.
		 */
		lm.context.widgetTitle = function () {
			var container = lm.context.widgetContainer();
			try {
				return container ? container.querySelector(lm.context.selectors.title) : null;
			} catch (e) {
				return null;
			}
		};

		/**
		 * Returns the parent element of the widget container (the dashboard grid cell).
		 *
		 * @returns {Element|null} The element or null.
		 */
		lm.context.widgetParent = function () {
			var container = lm.context.widgetContainer();
			return container ? container.parentElement : null;
		};

		/**
		 * Reads a value from the portal's LMGlobalData object using a dotted path.
		 *
		 * @param {string} path - Dotted path, for example "googleMapInfo.key".
		 * @param {*} [fallback=null] - Value when the path is missing.
		 * @returns {*} The value or the fallback.
		 */
		lm.context.globalData = function (path, fallback) {
			var fb = fallback === undefined ? null : fallback;
			try {
				var node = contextWindow().LMGlobalData;
				var parts = String(path || '').split('.').filter(Boolean);
				for (var i = 0; i < parts.length; i++) {
					if (node === null || node === undefined) return fb;
					node = node[parts[i]];
				}
				return node === undefined || node === null ? fb : node;
			} catch (e) {
				return fb;
			}
		};

		/**
		 * Replaces characters that are unsafe in cookie names or keys with underscores.
		 *
		 * @param {*} id - Value to sanitize.
		 * @returns {string} Sanitized string.
		 */
		lm.context.sanitizeId = function (id) {
			return String(id).replace(/[^A-Za-z0-9_-]/g, '_');
		};

		/**
		 * Builds a storage key unique to the current dashboard and widget, so several
		 * widgets (or several instances of one widget) do not overwrite each other's settings.
		 *
		 * @param {string} base - Base name.
		 * @returns {string} Key in the form base_dashboardId_widgetId.
		 */
		lm.context.scopedKey = function (base) {
			var parts = [base, lm.context.dashboardId() || 'default'];
			var widget = lm.context.widgetId();
			if (widget) parts.push(lm.context.sanitizeId(widget));
			return parts.join('_');
		};

		/**
		 * Reads a cookie from this document.
		 *
		 * @param {string} name - Cookie name.
		 * @returns {string|null} Decoded value or null.
		 */
		lm.context.getCookie = function (name) {
			var doc = W().document;
			if (!doc || !doc.cookie) return null;
			var parts = doc.cookie.split(';');
			for (var i = 0; i < parts.length; i++) {
				var pair = parts[i].trim();
				var eq = pair.indexOf('=');
				if (eq > 0 && pair.slice(0, eq) === name) {
					try {
						return decodeURIComponent(pair.slice(eq + 1));
					} catch (e) {
						return pair.slice(eq + 1);
					}
				}
			}
			return null;
		};

		/**
		 * Writes a cookie. Objects are stored as JSON.
		 *
		 * @param {string} name - Cookie name.
		 * @param {*} value - String or JSON-serializable value.
		 * @param {object} [opts] - maxAge in seconds (default one year), path (default "/"), sameSite (default "Lax").
		 */
		lm.context.setCookie = function (name, value, opts) {
			var o = opts || {};
			var text = typeof value === 'string' ? value : JSON.stringify(value);
			W().document.cookie = name + '=' + encodeURIComponent(text) + ';path=' + (o.path || '/') +
				';max-age=' + (o.maxAge === undefined ? 31536000 : o.maxAge) + ';SameSite=' + (o.sameSite || 'Lax');
		};

		/**
		 * Deletes a cookie.
		 *
		 * @param {string} name - Cookie name.
		 * @param {string} [path='/'] - Cookie path.
		 */
		lm.context.deleteCookie = function (name, path) {
			W().document.cookie = name + '=;path=' + (path || '/') + ';max-age=0';
		};

		/**
		 * Reads a JSON cookie, returning the fallback on missing or invalid data.
		 *
		 * @param {string} name - Cookie name.
		 * @param {*} [fallback=null] - Value when missing or unparsable.
		 * @returns {*} Parsed value or the fallback.
		 */
		lm.context.getJsonCookie = function (name, fallback) {
			var raw = lm.context.getCookie(name);
			if (raw === null) return fallback === undefined ? null : fallback;
			try {
				return JSON.parse(raw);
			} catch (e) {
				return fallback === undefined ? null : fallback;
			}
		};

		/**
		 * Injects a style element into the parent page once (identified by id). Useful because the
		 * widget DOM lives in the parent page, outside this iframe.
		 *
		 * @param {string} id - Id for the style element.
		 * @param {string} css - CSS text.
		 * @returns {boolean} True when the style exists after the call.
		 */
		lm.context.injectParentStyle = function (id, css) {
			var doc = lm.context.parentDocument();
			if (!doc) return false;
			try {
				if (doc.getElementById(id)) return true;
				var style = doc.createElement('style');
				style.id = id;
				style.textContent = css;
				doc.head.appendChild(style);
				return true;
			} catch (e) {
				return false;
			}
		};

		/**
		 * Sets an inline style only when it differs, avoiding needless layout and resize cycles.
		 *
		 * @param {Element} element - Target element.
		 * @param {string} property - Style property (camelCase).
		 * @param {string} value - New value.
		 * @returns {boolean} True when the style was changed.
		 */
		lm.context.setStyleIfChanged = function (element, property, value) {
			if (!element || element.style[property] === value) return false;
			element.style[property] = value;
			return true;
		};

		/**
		 * Sets the height of this widget's iframe (in pixels) if it changed.
		 *
		 * @param {number} height - Height in pixels.
		 * @returns {boolean} True when the height was changed.
		 */
		lm.context.resizeFrame = function (height) {
			return lm.context.setStyleIfChanged(lm.context.widgetFrame(), 'height', Math.max(0, Math.round(height)) + 'px');
		};

		/**
		 * Returns the content height of this document (the html element is auto-height, so this
		 * can shrink as well as grow).
		 *
		 * @returns {number} Height in pixels.
		 */
		lm.context.contentHeight = function () {
			var doc = W().document;
			return doc && doc.documentElement ? doc.documentElement.offsetHeight : 0;
		};

		/**
		 * Calls a function when the document has loaded (immediately if it already has).
		 *
		 * @param {Function} fn - Callback.
		 */
		lm.context.onReady = function (fn) {
			var w = W();
			if (w.document && w.document.readyState === 'complete') fn();
			else w.addEventListener('load', function () { fn(); }, { once: true });
		};

		/**
		 * Watches the document for size changes, coalescing bursts into one callback per animation
		 * frame. Only one observer is created per call.
		 *
		 * @param {Function} fn - Called with no arguments after a resize.
		 * @param {Element} [element] - Element to observe (default the html element).
		 * @returns {Function} Function that stops observing.
		 */
		lm.context.observeSize = function (fn, element) {
			var w = W();
			var scheduled = false;
			var Observer = w.ResizeObserver;
			if (!Observer) return function () {};
			var raf = w.requestAnimationFrame ? w.requestAnimationFrame.bind(w) : function (cb) { return setTimeout(cb, 16); };
			var observer = new Observer(function () {
				if (scheduled) return;
				scheduled = true;
				raf(function () {
					scheduled = false;
					fn();
				});
			});
			observer.observe(element || w.document.documentElement);
			return function () { observer.disconnect(); };
		};

		/**
		 * Returns the portal host name (for example "company.logicmonitor.com").
		 *
		 * @returns {string} Host name or an empty string.
		 */
		lm.context.portal = function () {
			var w = contextWindow();
			return w ? w.location.hostname : '';
		};

		/**
		 * Reads a widget token value from a hidden element. Unresolved ##token## placeholders
		 * and empty values return the fallback.
		 *
		 * @param {string} elementId - Id of the element holding the token text.
		 * @param {*} [fallback=null] - Value when the token is missing or unresolved.
		 * @returns {string|*} Token text or the fallback.
		 */
		lm.context.getToken = function (elementId, fallback) {
			var fb = fallback === undefined ? null : fallback;
			if (!W().document) return fb;
			var el = W().document.getElementById(elementId);
			if (!el) return fb;
			var text = el.innerText !== undefined ? el.innerText : el.textContent;
			return isNil(text) ? fb : String(text).trim();
		};

		// ------------------------------------------------------------
		// Logging...

		/**
		 * Sets the minimum level written to the console and transports.
		 *
		 * @param {'debug'|'info'|'warn'|'error'|'silent'} level - Level name.
		 * @returns {object} The SDK instance.
		 */
		lm.setLevel = function (level) {
			if (LOG_LEVELS[level] === undefined) throw new LMError('Unknown log level: ' + level);
			cfg.logLevel = level;
			return lm;
		};

		/**
		 * Returns the current log level.
		 *
		 * @returns {string} Level name.
		 */
		lm.getLevel = function () {
			return cfg.logLevel;
		};

		lm.logger = {};

		/**
		 * Registers a custom log transport. Each entry is { level, msg, timestamp, widget, meta }.
		 *
		 * @param {Function} fn - Transport function (exceptions are swallowed).
		 * @returns {Function} Function that removes the transport.
		 */
		lm.logger.addTransport = function (fn) {
			transports.push(fn);
			return function () {
				var i = transports.indexOf(fn);
				if (i !== -1) transports.splice(i, 1);
			};
		};

		/**
		 * Writes a log entry to the console and any transports and the LM Logs queue.
		 *
		 * @param {string} level - debug, info, warn or error.
		 * @param {*} message - Message text, Error or object.
		 * @param {*} [meta] - Optional structured metadata.
		 */
		function writeLog(level, message, meta) {
			if (LOG_LEVELS[level] < LOG_LEVELS[cfg.logLevel]) return;
			var entry = {
				level: level,
				msg: redact(messageToString(message)),
				timestamp: new Date(cfg.now()).toISOString(),
				widget: cfg.widgetName,
				meta: meta === undefined ? undefined : redact(meta)
			};
			var sink = root.console && (root.console[level] || root.console.log);
			if (sink) {
				if (entry.meta === undefined) sink.call(root.console, '[' + cfg.widgetName + '] ' + entry.msg);
				else sink.call(root.console, '[' + cfg.widgetName + '] ' + entry.msg, entry.meta);
			}
			transports.slice().forEach(function (t) {
				try { t(entry); } catch (e) { /* transports must never break the widget... */ }
			});
			if (cfg.logs.enabled) enqueueLog(entry);
		}

		/**
		 * Logs a debug message.
		 *
		 * @param {*} message - Message.
		 * @param {*} [meta] - Metadata.
		 */
		lm.debug = function (message, meta) { writeLog('debug', message, meta); };

		/**
		 * Logs an informational message (console, plus LM Logs when enabled).
		 *
		 * @param {*} message - Message.
		 * @param {*} [meta] - Metadata.
		 */
		lm.info = function (message, meta) { writeLog('info', message, meta); };

		/**
		 * Logs a warning.
		 *
		 * @param {*} message - Message.
		 * @param {*} [meta] - Metadata.
		 */
		lm.warn = function (message, meta) { writeLog('warn', message, meta); };

		/**
		 * Logs an error.
		 *
		 * @param {*} message - Message or Error.
		 * @param {*} [meta] - Metadata.
		 */
		lm.error = function (message, meta) { writeLog('error', message, meta); };

		/**
		 * Adds an entry to the LM Logs batch queue and schedules a flush.
		 *
		 * @param {object} entry - Log entry.
		 */
		function enqueueLog(entry) {
			if (logQueue.length >= cfg.logs.maxQueue) logQueue.shift();
			logQueue.push(entry);
			if (logQueue.length >= cfg.logs.batchSize) {
				lm.logger.flush();
			} else if (!logTimer) {
				logTimer = setTimeout(function () { lm.logger.flush(); }, cfg.logs.flushMs);
				if (logTimer && logTimer.unref) logTimer.unref();
			}
		}

		/**
		 * Sends queued entries to LM Logs (POST to the log ingest endpoint). Failures drop the
		 * batch and warn once to the console without re-entering the logger.
		 *
		 * @async
		 * @returns {Promise<boolean>} True when a batch was sent successfully (or nothing to send).
		 */
		lm.logger.flush = async function () {
			clearTimeout(logTimer);
			logTimer = null;
			if (logFlushing || !logQueue.length) return true;
			if (!cfg.logs.resourceId) {
				if (!logFailureWarned && root.console) {
					root.console.warn('[' + cfg.widgetName + '] LM Logs forwarding is enabled but logs.resourceId is not set; entries dropped.');
					logFailureWarned = true;
				}
				logQueue = [];
				return false;
			}
			logFlushing = true;
			var batch = logQueue.splice(0, cfg.logs.batchSize);
			var payload = batch.map(function (e) {
				var item = {
					msg: e.msg,
					timestamp: e.timestamp,
					'_lm.resourceId': cfg.logs.resourceId,
					level: e.level,
					widget: e.widget
				};
				if (e.meta !== undefined) item.meta = messageToString(e.meta);
				return item;
			});
			try {
				await lm.client.request({
					path: cfg.logs.signPath, verb: 'POST', body: payload, base: cfg.logs.endpoint.replace(cfg.logs.signPath, ''),
					retry: false
				});
				return true;
			} catch (e) {
				if (!logFailureWarned && root.console) {
					root.console.warn('[' + cfg.widgetName + '] Failed to send logs to LM Logs: ' + (e && e.message));
					logFailureWarned = true;
				}
				return false;
			} finally {
				logFlushing = false;
				if (logQueue.length) setTimeout(function () { lm.logger.flush(); }, 0);
			}
		};

		/**
		 * Flushes queued logs when the page is hidden or unloaded.
		 */
		function hookLifecycle() {
			if (lifecycleHooked || !root.addEventListener) return;
			lifecycleHooked = true;
			root.addEventListener('pagehide', function () { lm.logger.flush(); });
			if (root.document && root.document.addEventListener) {
				root.document.addEventListener('visibilitychange', function () {
					if (root.document.visibilityState === 'hidden') lm.logger.flush();
				});
			}
		}

		// ------------------------------------------------------------
		// Utilities...

		lm.nil = isNil;
		lm.isTruthy = isTruthy;
		lm.escapeHtml = escapeHtml;
		lm.debounce = debounce;
		lm.sleep = sleep;
		lm.formatDate = formatDate;
		lm.buildFilterValue = formatFilterValue;
		lm.create = createLM;

		if (initialConfig) lm.configure(initialConfig);
		return lm;
	}

	var defaultInstance = createLM();

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = defaultInstance;
		module.exports.LMError = LMError;
	}
	if (root) root.lm = defaultInstance;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
