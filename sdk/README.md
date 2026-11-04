# LogicMonitor Widget SDK (`lm`)

A single-file, no-build JavaScript library that simplifies common [LogicMonitor REST API v3](https://www.logicmonitor.com/swagger-ui-master/api-v3/dist/) operations inside custom dashboard widgets. Its conventions are modeled on ServiceNow's GlideScript (`lm.info()`, `lm.query().addQuery()`, `lm.nil()`).

The file is ASCII only (required by LogicMonitor's HTML sanitizer) and has no dependencies.

## Install

```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_ORG/custom_widgets@main/sdk/lm-sdk.js"></script>
```

Replace `YOUR_ORG` and pin a tag or commit instead of `main` for production widgets. The script exposes a global `lm`. Use `lm.create(config)` to get an independent instance.

## Quick start

```js
lm.configure({ widgetName: "My Widget" });
lm.auth.fromTokens();                       // optional, see Authentication

var devices = await lm.getDevices({ filter: { hostStatus: "normal" }, fields: "id,displayName" });
lm.info("Loaded " + devices.length + " devices");
```

## Authentication

Chosen automatically, highest priority first:

1. **Bearer token** - `lm.configure({ bearerToken })`
2. **LMv1** - `lm.configure({ accessId, accessKey })` (HMAC-SHA256, signature is base64 of the hex digest)
3. **Integrated session** (default) - fetches and caches a CSRF token (5 minute TTL, one shared in-flight request, one refresh on 401/403). Requires no configuration inside the portal.

`lm.auth.fromTokens()` reads hidden widget token elements (`apiBearerTokenToken`, `apiIDToken`, `apiKeyToken` by default) and ignores unresolved `##token##` placeholders. `lm.auth.mode()` returns `'bearer'`, `'lmv1'` or `'session'`.

## API reference

### Configuration

`lm.configure({ bearerToken, accessId, accessKey, apiVersion = '3', restBase = '/santaba/rest', widgetName, logLevel = 'info', retry: { max: 2, baseMs: 500 }, logs: {...} })`

### Client

| Call | Purpose |
| --- | --- |
| `lm.client.request({ path, verb, query, body, version, signal, base, retry })` | Generalized request. Throws `lm.LMError` (`status`, `statusText`, `body`, `path`, `verb`, `code`). |
| `lm.get(path, query, opts)` | Single GET. |
| `lm.getAll(path, { filter, fields, sort, size, maxItems, onProgress, signal })` | Paginates to `{ items, total }`. Safe against empty pages and negative totals. |

429 responses are retried (all verbs); network errors and 502/503/504 are retried for GET only.

### Query builder

```js
var items = await lm.query("devices")
	.addQuery("hostStatus", "normal")        // equals
	.addQuery("displayName", "~", "prod")    // contains
	.addOrQuery("name", "!=", "lab")
	.fields("id,displayName")
	.orderBy("displayName")                  // or orderByDesc
	.limit(500)
	.getItems();
```

Operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `~`/`contains`, `!~`/`!contains`. Terminal methods: `get(offset)` (one page), `getAll()`, `getItems()`, `first()`, `getById(id)`, `count()`. Also `addRawFilter`, `pageSize`, `param`, `signal`, `onProgress`, `getFilter()`.

Resources: `devices`, `resources`, `deviceGroups`, `resourceGroups`, `alerts`, `websites`, `websiteGroups`, `collectors`, `collectorGroups`, `dashboards`, `dashboardGroups`, `widgets`, `sdts`, `auditLogs`, `datasources`, `alertRules`, `escalationChains`, `integrations`, `users`, `roles`, or any path beginning with `/`.

### Shortcuts

List shortcuts return arrays and take `{ filter, fields, sort, size, maxItems, onProgress, signal }`. `filter` may be a raw string, an object of equality pairs, or an array of `[field, operator, value]`.

- `getDevices`, `getDeviceGroups`, `getAlerts`, `getWebsites`, `getWebsiteGroups`, `getCollectors`, `getCollectorGroups`, `getDashboards`, `getDashboardGroups`, `getWidgets`, `getSDTs`, `getAuditLogs`, `getDatasources`, `getAlertRules`, `getEscalationChains`, `getIntegrations`
- By id: `getDevice(id)`, `getDeviceGroup`, `getAlert`, `getWebsite`, `getCollector`, `getDashboard`, `getWidget`, `getDatasource`
- Sub-collections: `getDeviceDataSources(deviceId)`, `getDeviceInstances(deviceId, deviceDataSourceId)`, `getProperties(deviceId)`, `getDeviceGroupDevices(groupId)`, `getDashboardWidgets(dashboardId)`
- Data: `getInstanceData(deviceId, deviceDataSourceId, instanceId, { start, end })`, `getGraphData(deviceId, ddsId, instanceId, graphId, { start, end })`, `getWidgetData(widgetId)`
- `lm.getProperty(device, name, fallback)` searches custom, system, auto and inherited properties.

### Context

Helpers for widgets running in LogicMonitor's iframe. Each returns `null`, `''` or `false` instead of throwing when the parent page is unreachable.

| Call | Returns |
| --- | --- |
| `lm.context.dashboardId()` | Numeric dashboard id from the parent URL (`dashboards-2338`), or `''`. |
| `lm.context.portal()` | Portal host name. |
| `lm.context.isEmbedded()` / `parentDocument()` | Whether the parent page is readable, and its document. |
| `lm.context.widgetFrame()` | This widget's iframe element. |
| `lm.context.widgetElement()` / `widgetId()` | Nearest element with an id around the iframe, and its id. |
| `lm.context.widgetContainer()` | The outer styled widget card (falls back to `widgetElement()`). |
| `lm.context.widgetTitle()` / `widgetParent()` | The title element and the grid cell holding the card. |
| `lm.context.globalData('googleMapInfo.key', fallback)` | Value from the portal's `LMGlobalData` by dotted path. |
| `lm.context.getToken(elementId, fallback)` | Widget token text, ignoring unresolved `##token##` placeholders. |
| `lm.context.scopedKey(base)` | `base_dashboardId_widgetId`, for per-widget settings. |
| `lm.context.getCookie/setCookie/deleteCookie/getJsonCookie` | Cookie helpers (JSON values supported). |
| `lm.context.injectParentStyle(id, css)` | Adds a style element to the parent page once. |
| `lm.context.setStyleIfChanged(el, prop, value)` | Writes an inline style only when it differs. |
| `lm.context.resizeFrame(px)` / `contentHeight()` | Resize the iframe, and read the document's content height. |
| `lm.context.onReady(fn)` | Runs `fn` after load (immediately if already loaded). |
| `lm.context.observeSize(fn, element)` | Coalesced ResizeObserver; returns a stop function. |

`lm.context.selectors` holds the CSS selectors for LogicMonitor's generated markup (`widget`, `title`). If a portal update breaks `widgetContainer()` or `widgetTitle()`, override them there.

Reading or styling the parent page requires the portal's **Allow Scripts in Dashboard Text Widgets** setting, and the iframe must be same-origin with the portal.

### Logging

`lm.debug / info / warn / error(message, meta)` write to the browser console with a `[widgetName]` prefix, honor `lm.setLevel()`, and redact bearer tokens, LMv1 headers and metadata keys such as `token`, `secret`, `password`, `apiKey`.

**Audit log limitation:** the LogicMonitor REST API cannot write to the audit log (it is read-only; use `lm.getAuditLogs`). To keep messages, forward them to LM Logs:

```js
lm.configure({
	logs: {
		enabled: true,
		resourceId: { "system.hostname": "dashboard-widgets" },  // must match a monitored resource
		batchSize: 50,
		flushMs: 5000
	}
});
```

Entries are batched and POSTed to `/rest/log/ingest` (flushed on batch size, timer, `pagehide` and `visibilitychange`). Failed batches are dropped with a single console warning. The ingest endpoint requires bearer or LMv1 credentials with log ingest permission; it may not accept integrated session auth. Add other destinations with `lm.logger.addTransport(fn)`.

### Utilities

`lm.nil`, `lm.isTruthy`, `lm.escapeHtml`, `lm.debounce`, `lm.sleep`, `lm.formatDate`.

## Development

```
node --test sdk/test        # unit tests (Node 18+)
node tools/check-sdk.js     # ASCII-only and syntax check
```

See [examples/device-list-widget.html](examples/device-list-widget.html) for a working widget.
