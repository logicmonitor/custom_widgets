# LogicMonitor Widget SDK (`lm`)

A single-file, no-build JavaScript library that helps simplify development of custom LogicMonitor dashboard widgets.

## Installation

Include the following line in the source view of your LogicMonitor Text widget:

```html
<script src="https://cdn.jsdelivr.net/gh/logicmonitor/custom_widgets@main/sdk/lm-sdk.js"></script>
```

The script exposes a global `lm` JavaScript object. You can then use `lm.create(config)` to create an independent instance.

## Quick start

```js
lm.configure({ widgetName: "My Widget" });
lm.auth.fromTokens();                       // optional, see Authentication

var devices = await lm.getDevices({ filter: { hostStatus: "normal" }, fields: "id,displayName" });
lm.info("Loaded " + devices.length + " devices");
```

### Examples

These are complete example widgets you can paste into a Text widget's Source view to experiment with:

- [examples/device-list-widget.html](examples/device-list-widget.html) is a minimal widget that lists devices with active alerts using the query builder and `lm.getAlerts`.
- [examples/instance-browser-widget.html](examples/instance-browser-widget.html) is a drill-down widget: choose a resource, then a datasource, and it lists that datasource's instances. It uses `lm.auth.fromTokens`, `lm.context.onReady`, `lm.getDevices`, `lm.getDeviceDataSources`, `lm.getDeviceInstances` and `lm.getStatusColor`, and ignores slow responses from an earlier selection.

## Authentication

The SDK supports multiple forms of LogicMonitor's API authentication to allow for different scenarios. These are chosen in the following order:

1. **Bearer token** - `lm.configure({ bearerToken })`
2. **LMv1** - `lm.configure({ accessId, accessKey })` (HMAC-SHA256, signature is base64 of the hex digest)
3. **Integrated session** (default) - API calls will use the current user's permissions. Requires no configuration inside the portal.

`lm.auth.fromTokens()` reads hidden widget token elements (`apiBearerTokenToken`, `apiIDToken`, `apiKeyToken` by default) and ignores unresolved `##token##` placeholders. `lm.auth.mode()` returns `'bearer'`, `'lmv1'` or `'session'`.

## API reference

Conventions used below:

- Functions marked **async** return a promise; use `await` or `.then()`.
- API failures throw an [`LMError`](#errors). Aborting with an `AbortSignal` throws a standard `AbortError` instead.
- "Epoch seconds" are Unix timestamps in seconds, which is what LogicMonitor's API uses.
- Examples assume they run inside an `async` function.
- Functions marked **Read only** send only `GET` requests (or no request at all) and never create, change or delete anything in your LogicMonitor portal. See [Read-only and write-capable functions](#read-only-and-write-capable-functions).

### Read-only and write-capable functions

The SDK is built around `GET` operations, so nearly everything is read only. Only two things can send anything other than a `GET`:

| Function | Behavior |
| --- | --- |
| `lm.client.request(opts)` | **Write capable.** Sends the `verb` you give it: `POST`, `PUT` and `PATCH` can change portal data (with whatever permissions your credentials have). It is read only when `verb` is `GET` (the default). **NOTE:** `DELETE` operations are not allowed by default - the SDK will reject it with an `LMError` before sending anything. |
| LM Logs forwarding / `lm.logger.flush()` | **Writes log entries.** When `logs.enabled` is set, queued log messages are `POST`ed to LM Logs. This adds log data but does not change any portal configuration. It is off by default. |

Everything else falls into one of these groups:

| Group | Functions | Notes |
| --- | --- | --- |
| **Read only (API)** | `lm.get`, `lm.getAll`, `lm.query(...)` and its terminal methods `get`, `getAll`, `getItems`, `first`, `getById`, `count`, every list, by-id and sub-collection shortcut (`getDevices`, `getAlert`, `getDeviceInstances`, ...), `getDatasourceId`, `getDeviceDataSource`, `getDatasourceInstances`, `getInstanceData`, `getGraphData`, `getWidgetData`, `lm.auth.getCsrfToken` | Only `GET` requests. |
| **Read only (no request)** | `lm.query` builder methods (`addQuery`, `addOrQuery`, `addRawFilter`, `fields`, `orderBy`, `orderByDesc`, `limit`, `pageSize`, `param`, `signal`, `onProgress`, `getFilter`, `getParams`), `lm.getProperty`, `lm.getStatusColor`, `lm.auth.mode`, `lm.auth.signLMv1`, `lm.auth.fromTokens`, `lm.configure`, `lm.setLevel`, `lm.getLevel`, `lm.buildFilterValue`, and all [Utilities](#utilities) | Make no API calls. `configure`, `setLevel` and `fromTokens` only change the SDK's own settings. |
| **Read only (page)** | `lm.context.dashboardId`, `portal`, `isEmbedded`, `parentDocument`, `widgetFrame`, `widgetElement`, `widgetId`, `widgetContainer`, `widgetTitle`, `widgetParent`, `globalData`, `getToken`, `sanitizeId`, `scopedKey`, `getCookie`, `getJsonCookie`, `contentHeight` | Only read the page. |
| **Temporarily changes the page** | `lm.context.setCookie`, `deleteCookie`, `injectParentStyle`, `injectStyle`, `setStyleIfChanged`, `resizeFrame`, `onReady`, `observeSize` | Modify cookies, styles or the iframe size in the browser only. Nothing is sent to LogicMonitor. |
| **Console and transports** | `lm.debug`, `info`, `warn`, `error`, `lm.logger.addTransport` | Write to the browser console and your own transports; they reach LM Logs only if forwarding is enabled. |

Tip: to be certain a widget can never change portal data, use an API token whose role only has view permissions, and avoid calling `lm.client.request` with a non-`GET` verb.

### Configuration

<details>
<summary><strong><code>lm.configure(options)</code></strong></summary>

Updates the SDK configuration and returns `lm`, so calls can be chained. Unknown keys are ignored, and placeholder values such as `##apiKey##` are treated as not set since those need to be directly captured from HTML elements (the included SDK won't see them at runtime).

| Option | Default | Description |
| --- | --- | --- |
| `bearerToken` | `''` | LogicMonitor API bearer token. Highest priority auth. |
| `accessId`, `accessKey` | `''` | LMv1 API token ID and key. Both are required to use LMv1. |
| `apiVersion` | `'3'` | Sent as the `X-Version` header. |
| `restBase` | `'/santaba/rest'` | Base path for API calls. |
| `widgetName` | `'widget'` | Prefix for console messages (`[widgetName] message`) and the `widget` field in LM Logs. |
| `logLevel` | `'info'` | `debug`, `info`, `warn`, `error` or `silent`. Same as `lm.setLevel()`. |
| `retry` | `{ max: 2, baseMs: 500 }` | Retry count and the initial backoff in milliseconds (doubles each attempt). |
| `csrfTtlMs` | `300000` | How long a session CSRF token is cached. |
| `logs` | see [Logging](#logging) | LM Logs forwarding settings. Merged into the existing values. |
| `fetch` | `window.fetch` | Replacement `fetch`, mainly for tests. |
| `window` | the real window | Replacement window object, mainly for tests of the `lm.context` helpers. |

```js
lm.configure({ widgetName: "Capacity Widget", logLevel: "debug", retry: { max: 4 } });
```

</details>

#### Properties

| Property | Description |
| --- | --- |
| `lm.version` | The SDK version string, for example `"1.0.0"`. |
| `lm.LMError` | The error class thrown by the SDK. See [Errors](#errors). |

<details>
<summary><strong><code>lm.create(config)</code></strong></summary>

Creates a new, independent SDK instance with its own configuration, token cache, logger and queues. Use it when one page needs to talk to the API with different credentials, or when you want logging settings that do not affect other scripts. The global `lm` is itself a default instance.

```js
var other = lm.create({ bearerToken: "...", widgetName: "Other" });
var alerts = await other.getAlerts({ maxItems: 10 });
```

</details>

### Authentication functions

<details>
<summary><strong><code>lm.auth.fromTokens(elementIds)</code></strong></summary>

Reads credentials from hidden widget token elements, applies them with `lm.configure()`, and returns the resulting auth mode. Elements are looked up with `lm.context.getToken`, so unresolved `##token##` placeholders are ignored and the integrated session is used when no credentials were supplied.

`elementIds` is optional. Each key is the id of a hidden element holding the token:

| Key | Default element id |
| --- | --- |
| `bearerToken` | `apiBearerTokenToken` |
| `accessId` | `apiIDToken` |
| `accessKey` | `apiKeyToken` |

```html
<div id="apiBearerTokenToken" style="display:none">##apiBearerToken##</div>
<script>
	lm.auth.fromTokens();                                   // default element ids
	lm.auth.fromTokens({ bearerToken: "myTokenElement" });  // custom element id
</script>
```

</details>

<details>
<summary><strong><code>lm.auth.getCsrfToken(forceRefresh)</code> (async)</strong></summary>

Returns the CSRF token used by session auth. The token is cached (see `csrfTtlMs`), and concurrent callers share one request. Pass `true` to bypass the cache. You rarely need this directly because `lm.client.request` calls it for you and refreshes once automatically on a 401 or 403.

```js
var token = await lm.auth.getCsrfToken();
var fresh = await lm.auth.getCsrfToken(true);
```

</details>

<details>
<summary><strong><code>lm.auth.mode()</code></strong></summary>

Returns the active auth mode: `'bearer'`, `'lmv1'` or `'session'`.

```js
lm.configure({ accessId: "id", accessKey: "key" });
lm.auth.mode();   // "lmv1"
```

</details>

<details>
<summary><strong><code>lm.auth.signLMv1(verb, resourcePath, body, epoch)</code> (async)</strong></summary>

Returns an LMv1 `Authorization` header value. The signature is the base64 encoding of the hex-encoded HMAC-SHA256 of `verb + epoch + body + resourcePath`. The body is included only for `POST`, `PUT` and `PATCH`. `resourcePath` is the path without the base and query string (for example `/device/devices`). `epoch` is in milliseconds and defaults to now.

```js
lm.configure({ accessId: "id", accessKey: "key" });
var header = await lm.auth.signLMv1("GET", "/device/devices");
// "LMv1 id:<signature>:<epoch>"
```

</details>

### Client

<details>
<summary><strong><code>lm.client.request(opts)</code> (async)</strong></summary>

The generalized request function that everything else is built on. Returns the parsed JSON response, or `{}` for a 204 or empty body.

**Write capable:** read only when `verb` is `GET` (the default); `POST`, `PUT` and `PATCH` can change portal data. **NOTE:** `DELETE` operations are not allowed by default - the SDK will reject it with an `LMError` before sending anything.

| Option | Description |
| --- | --- |
| `path` | Required. Resource path such as `/device/devices`. A leading `/` is added if missing. |
| `verb` | `GET` (default), `POST`, `PUT` or `PATCH`. `DELETE` is not allowed by default. |
| `query` | Query string (with or without `?`) or an object. Empty, `null` and `undefined` values are skipped; values are URL-encoded. |
| `body` | JSON body for `POST`, `PUT` and `PATCH`. Objects are stringified. |
| `version` | API version override for this call. |
| `signal` | An `AbortSignal` to cancel the request. |
| `base` | Override the REST base for this call (the SDK uses it for log ingest). |
| `retry` | Set `false` to disable retries. |

Retries: `429` responses are retried for every verb (waiting for the `X-Rate-Limit-Window` header when it is 60 seconds or less). Network errors and `502`/`503`/`504` are retried for `GET` only. Session auth refreshes the CSRF token once on a 401 or 403. Throws an [`LMError`](#errors) for any other failure.

```js
var device = await lm.client.request({ path: "/device/devices/42", query: { fields: "id,displayName" } });

await lm.client.request({
	path: "/device/devices/42",
	verb: "PATCH",
	body: { description: "Updated from a widget" }
});
```

</details>

<details>
<summary><strong><code>lm.get(path, query, opts)</code> (async)</strong></summary>

Shorthand for a single `GET`. `opts` may contain `version`, `signal` and `retry`.

```js
var response = await lm.get("/device/devices", { size: 5, fields: "id,displayName" });
// response.items, response.total
```

</details>

<details>
<summary><strong><code>lm.getAll(path, opts)</code> (async)</strong></summary>

Fetches every page of a list endpoint and returns `{ items, total }`. It starts at offset 0 and keeps requesting pages until the reported total is reached. It copes with endpoints that report a negative total (alerts) by continuing until a short page arrives, and it stops (with a warning) if a page comes back empty, so it can never loop forever.

| Option | Description |
| --- | --- |
| `filter` | Raw LogicMonitor filter string. |
| `fields` | Comma separated fields to return. |
| `sort` | Sort expression, for example `+displayName` or `-id`. |
| `size` | Page size (default and maximum 1000). |
| `maxItems` | Stop and trim the result after this many items. |
| `onProgress(loaded, total)` | Called after each page. `total` is `undefined` when unknown. |
| `signal` | An `AbortSignal`. |
| `params` | Extra query parameters to send on every page. |

```js
var result = await lm.getAll("/device/devices", {
	filter: 'hostStatus:"normal"',
	fields: "id,displayName",
	onProgress: function (loaded, total) { lm.debug("Loaded " + loaded + " of " + total); }
});
lm.info(result.items.length + " of " + result.total + " devices");
```

</details>

### Query builder

`lm.query(resource)` returns a builder, modeled on ServiceNow's GlideRecord, for list endpoints. Builder methods return the same query so calls chain; terminal methods send requests.

**Read only:** the builder only sends `GET` requests.

| Method | Type | Purpose |
| --- | --- | --- |
| `addQuery`, `addOrQuery`, `addRawFilter` | Builder | Add filter conditions (AND, OR, raw). |
| `fields`, `orderBy`, `orderByDesc` | Builder | Choose returned fields and sort order. |
| `limit`, `pageSize` | Builder | Limit total items and set the page size. |
| `param`, `signal`, `onProgress` | Builder | Extra parameters, cancellation and progress callback. |
| `getFilter`, `getParams` | Inspect | Show what will be sent; no request. |
| `get`, `getAll`, `getItems`, `first`, `getById`, `count` | Terminal (async) | Send requests and return results. |

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

<details>
<summary><strong><code>lm.query(resource)</code></strong></summary>

Starts a query. `resource` is a friendly name from the table below or any path beginning with `/`. An unknown name throws an `LMError`.

| Resource | Path |
| --- | --- |
| `devices`, `resources` | `/device/devices` |
| `deviceGroups`, `resourceGroups` | `/device/groups` |
| `alerts` | `/alert/alerts` |
| `websites` | `/website/websites` |
| `websiteGroups` | `/website/groups` |
| `collectors` | `/setting/collector/collectors` |
| `collectorGroups` | `/setting/collector/groups` |
| `dashboards` | `/dashboard/dashboards` |
| `dashboardGroups` | `/dashboard/groups` |
| `widgets` | `/dashboard/widgets` |
| `sdts` | `/sdt/sdts` |
| `auditLogs` | `/setting/accesslogs` |
| `datasources` | `/setting/datasources` |
| `alertRules` | `/setting/alert/rules` |
| `escalationChains` | `/setting/alert/chains` |
| `integrations` | `/setting/integrations` |
| `users` | `/setting/admins` |
| `roles` | `/setting/roles` |

```js
var q = lm.query("devices");
var custom = lm.query("/device/devices/42/properties");
```

</details>

<details>
<summary><strong><code>.addOrQuery(field, value)</code> / <code>.addOrQuery(field, operator, value)</code></strong></summary>

Same as `addQuery`, but joins the condition to the previous one with LogicMonitor's OR (`||`).

```js
lm.query("devices").addQuery("name", "~", "web").addOrQuery("name", "~", "app");
// filter: name~"web"||name~"app"
```

</details>

<details>
<summary><strong><code>.addQuery(field, value)</code> / <code>.addQuery(field, operator, value)</code></strong></summary>

Adds a condition that is ANDed with the others. With two arguments the operator is equals. Strings are quoted and escaped; numbers and booleans are sent bare.

| Operator | Meaning | Sent as |
| --- | --- | --- |
| `=` (or `==`) | Equals | `:` |
| `!=` | Not equals | `!:` |
| `>` | Greater than | `>` |
| `>=` | Greater than or equal | `>:` |
| `<` | Less than | `<` |
| `<=` | Less than or equal | `<:` |
| `~` (or `contains`) | Contains | `~` |
| `!~` (or `!contains`) | Does not contain | `!~` |

LogicMonitor's own operators (`:`, `!:`, `>:`, `<:`) are accepted too. An unsupported operator throws an `LMError`.

```js
lm.query("devices")
	.addQuery("hostStatus", "normal")
	.addQuery("id", ">=", 100)
	.addQuery("displayName", "~", "prod");
// filter: hostStatus:"normal",id>:100,displayName~"prod"
```

</details>

<details>
<summary><strong><code>.addRawFilter(filter)</code></strong></summary>

Adds a raw LogicMonitor filter expression as an AND condition. Use it for syntax the builder doesn't cover. An empty value is ignored.

```js
lm.query("alerts").addRawFilter("severity>:3,cleared:false");
```

</details>

<details>
<summary><strong><code>.count()</code> (async)</strong></summary>

Returns the number of matching items without downloading them. If the API doesn't report a usable total (alerts), it pages through the ids and counts them.

```js
var critical = await lm.query("alerts").addQuery("severity", 4).addQuery("cleared", false).count();
```

</details>

<details>
<summary><strong><code>.fields(list)</code></strong></summary>

Sets the fields to return, as a comma separated string or an array. Requesting fewer fields makes responses much smaller. If unspecified then all fields will be returned.

```js
lm.query("devices").fields(["id", "displayName"]);
```

</details>

<details>
<summary><strong><code>.first()</code> (async)</strong></summary>

Returns the first matching item, or `null` when nothing matches. Requests only one item.

```js
var device = await lm.query("devices").addQuery("displayName", "web01").first();
```

</details>

<details>
<summary><strong><code>.get(offset)</code> (async)</strong></summary>

Fetches a single page, starting at `offset` (default 0), and returns `{ items, total }`. `total` is LogicMonitor's reported total, which can be negative for endpoints such as alerts.

```js
var page = await lm.query("devices").pageSize(50).get(100);
```

</details>

<details>
<summary><strong><code>.getAll()</code> (async)</strong></summary>

Fetches every page (see `lm.getAll`) and returns `{ items, total }`.

```js
var result = await lm.query("devices").addQuery("hostStatus", "dead").getAll();
```

</details>

<details>
<summary><strong><code>.getById(id)</code> (async)</strong></summary>

Fetches one item by id (`<path>/<id>`). Honors `.fields()`. Filters are not applied.

```js
var device = await lm.query("devices").fields("id,displayName,hostStatus").getById(42);
```

</details>

<details>
<summary><strong><code>.getFilter()</code> / <code>.getParams(offset)</code></strong></summary>

Inspect what will be sent without making a request. `getFilter()` returns the assembled filter string. `getParams(offset)` returns the query parameter object (`size`, `offset`, `fields`, `sort`, `filter`, plus anything added with `param`). Useful for debugging.

```js
var q = lm.query("devices").addQuery("hostStatus", "normal").fields("id").orderBy("id");
q.getFilter();     // 'hostStatus:"normal"'
q.getParams(0);    // { size: 1000, offset: 0, fields: "id", sort: "+id", filter: 'hostStatus:"normal"' }
```

</details>

<details>
<summary><strong><code>.getItems()</code> (async)</strong></summary>

Returns the same data as getAll() but with less to unwrap. Using `.getAll()` will return `{items, total}`, while `.getItems()` returns just `items` (a plain array). Both make the same requests and page the same way, so there is no performance difference.

```js
var devices = await lm.query("devices").fields("id,displayName").getItems();
```

</details>

<details>
<summary><strong><code>.limit(n)</code></strong></summary>

Limits the total number of items returned by `getAll()` and `getItems()`. When `n` is smaller than the page size, the page size is reduced to `n` too, so no extra items are downloaded.

```js
var newest = await lm.query("alerts").orderByDesc("startEpoch").limit(10).getItems();
```

</details>

<details>
<summary><strong><code>.onProgress(fn)</code></strong></summary>

Sets a callback for `getAll()` and `getItems()`, called after each page with `(loaded, total)`.

```js
lm.query("devices").onProgress(function (loaded, total) {
	status.textContent = loaded + " of " + total;
});
```

</details>

<details>
<summary><strong><code>.orderBy(field)</code> / <code>.orderByDesc(field)</code></strong></summary>

Sorts ascending (`+field`) or descending (`-field`). Only one sort field is kept; the last call wins.

```js
lm.query("alerts").orderByDesc("startEpoch");
```

</details>

<details>
<summary><strong><code>.pageSize(n)</code></strong></summary>

Sets the page size used for requests (1 to 1000, default 1000).

```js
lm.query("devices").pageSize(200);
```

</details>

<details>
<summary><strong><code>.param(key, value)</code></strong></summary>

Adds an extra query parameter sent with every request (for example `format` or `start`).

```js
lm.query("alerts").param("needMessage", true);
```

</details>

<details>
<summary><strong><code>.signal(abortSignal)</code></strong></summary>

Attaches an `AbortSignal` so the request (and any further pages) can be cancelled.

```js
var controller = new AbortController();
var pending = lm.query("devices").signal(controller.signal).getItems();
controller.abort();    // pending rejects with an AbortError
```

</details>

### Errors

#### `lm.LMError`

Every SDK failure (bad usage, network failure, HTTP error status, unparsable JSON) is an `LMError`, which extends `Error`.

| Property | Description |
| --- | --- |
| `message` | For HTTP errors, `API Error: <status> <statusText>` plus LogicMonitor's `errorMessage` when present. |
| `status`, `statusText` | HTTP status, when the error came from a response. |
| `body` | Raw response body text (or a placeholder when unreadable). |
| `code` | LogicMonitor's `errorCode`, when present. |
| `path`, `verb` | The request that failed. |
| `cause` | The underlying error for network and JSON failures. |

```js
try {
	await lm.getDevice(999999999);
} catch (e) {
	if (e instanceof lm.LMError && e.status === 404) lm.warn("No such device");
	else throw e;
}
```

### Shortcuts

Shortcuts are thin wrappers over the query builder for common requests. **All shortcuts are read only** (they send only `GET` requests), as is the whole query builder.

**List shortcuts** return an array of every matching item and take one optional `opts` object:

| Option | Description |
| --- | --- |
| `filter` | A raw filter string, an object of equality pairs (`{ hostStatus: "normal" }`), or an array of `[field, operator, value]` triples. |
| `fields` | Comma separated fields to return. |
| `sort` | Raw sort expression, for example `"-startEpoch"`. |
| `size` | Page size. |
| `maxItems` | Maximum number of items. |
| `onProgress(loaded, total)` | Progress callback. |
| `signal` | An `AbortSignal`. |

| Shortcut | Resource |
| --- | --- |
| `lm.getAlertRules(opts)`, `lm.getEscalationChains(opts)`, `lm.getIntegrations(opts)` | alert rules, escalation chains, integrations |
| `lm.getAlerts(opts)` | alerts |
| `lm.getAuditLogs(opts)` | audit (access) logs |
| `lm.getCollectors(opts)`, `lm.getCollectorGroups(opts)` | collectors and collector groups |
| `lm.getDashboards(opts)`, `lm.getDashboardGroups(opts)` | dashboards and dashboard groups |
| `lm.getDatasources(opts)` | datasource definitions |
| `lm.getDeviceGroups(opts)` | device groups |
| `lm.getDevices(opts)` | devices |
| `lm.getSDTs(opts)` | scheduled downtime |
| `lm.getWebsites(opts)`, `lm.getWebsiteGroups(opts)` | websites and website groups |
| `lm.getWidgets(opts)` | widgets |

```js
// Object of equality pairs
var normal = await lm.getDevices({ filter: { hostStatus: "normal" }, fields: "id,displayName" });

// Array of [field, operator, value]
var recent = await lm.getAlerts({
	filter: [["cleared", "=", false], ["severity", ">=", 3]],
	sort: "-startEpoch",
	maxItems: 100
});

// Raw filter string
var prod = await lm.getDevices({ filter: 'displayName~"prod"' });
```

**By-id shortcuts** return one item. They take the id and the same `opts` (only `fields` and `signal` apply):

| Shortcut | Returns |
| --- | --- |
| `lm.getAlert(id, opts)` | One alert. |
| `lm.getCollector(id, opts)` | One collector. |
| `lm.getDashboard(id, opts)` | One dashboard. |
| `lm.getDatasource(id, opts)` | One datasource definition. |
| `lm.getDevice(id, opts)` | One device (resource). |
| `lm.getDeviceGroup(id, opts)` | One device group. |
| `lm.getWebsite(id, opts)` | One website. |
| `lm.getWidget(id, opts)` | One widget. |

```js
var device = await lm.getDevice(42, { fields: "id,displayName,customProperties" });
var alert = await lm.getAlert("DS12345");    // alert ids are strings
```

#### Sub-collections

These take a parent id first and then the usual list `opts`, and return arrays.

| Shortcut | Returns |
| --- | --- |
| `lm.getDashboardWidgets(dashboardId, opts)` | Widgets on a dashboard. |
| `lm.getDeviceDataSources(deviceId, opts)` | The resource's datasource records (device datasources). |
| `lm.getDeviceGroupDevices(groupId, opts)` | Resources in a group. |
| `lm.getDeviceInstances(deviceId, deviceDataSourceId, opts)` | Instances for a device datasource. Takes the **device datasource id**, not the datasource id. |
| `lm.getProperties(deviceId, opts)` | The resource's properties. |

```js
var dds = await lm.getDeviceDataSources(42, { filter: { dataSourceName: "SNMP_Network_Interfaces" } });
var instances = await lm.getDeviceInstances(42, dds[0].id);
```

#### Datasource and data helpers

Helpers for finding a resource's datasource instances by name, reading time series data, and working with property and status values.

<details>
<summary><strong><code>lm.getDatasourceId(datasource, opts)</code> (async)</strong></summary>

Resolves a datasource name to the datasource `id`. A numeric value (number or digit string) is treated as an id and returned without a request. A name is matched exactly against `/setting/datasources`. Throws an `LMError` if the value is empty or no datasource has that name. `opts` may contain `signal`.

```js
var id = await lm.getDatasourceId("SNMP_Network_Interfaces");   // 1234 (looked up)
var same = await lm.getDatasourceId(1234);     // 1234 (no request)
```

</details>

<details>
<summary><strong><code>lm.getDatasourceInstances(deviceId, datasource, opts)</code> (async)</strong></summary>

The easiest way to list a datasource's instances on a resource. It resolves the datasource name to an id, finds the resource's device datasource, and lists its instances. Returns an empty array if the datasource is not applied to the resource, and throws if the datasource name doesn't exist. `opts` takes the usual list options.

```js
var cpus = await lm.getDatasourceInstances(42, "SNMP_Network_Interfaces", { fields: "id,name,alertStatus" });
```

</details>

<details>
<summary><strong><code>lm.getDeviceDataSource(deviceId, datasource, opts)</code> (async)</strong></summary>

Returns the record linking a resource to a datasource (the "device datasource"), or `null` when the datasource is not applied to the resource. `datasource` is a name or datasource id. The record's `id` is what `getDeviceInstances`, `getInstanceData` and `getGraphData` need, and it is different from the datasource id.

```js
var dds = await lm.getDeviceDataSource(42, "SNMP_Network_Interfaces");
if (dds) lm.info("Device datasource id: " + dds.id);
```

</details>

<details>
<summary><strong><code>lm.getGraphData(deviceId, deviceDataSourceId, instanceId, graphId, opts)</code> (async)</strong></summary>

Returns data for one instance graph.

| Option | Description |
| --- | --- |
| `start`, `end` | Time range in epoch seconds. |
| `signal` | An `AbortSignal`. |

```js
var graph = await lm.getGraphData(42, dds.id, instance.id, 7, { start: now - 86400, end: now });
```

</details>

<details>
<summary><strong><code>lm.getInstanceData(deviceId, deviceDataSourceId, instanceId, opts)</code> (async)</strong></summary>

Returns time series data for one instance. Without `start` and `end`, LogicMonitor returns its default recent window.

| Option | Description |
| --- | --- |
| `start`, `end` | Time range in epoch seconds. |
| `datapoints` | Comma separated datapoint names to return. |
| `signal` | An `AbortSignal`. |

```js
var now = Math.floor(Date.now() / 1000);
var data = await lm.getInstanceData(42, dds.id, instance.id, { start: now - 3600, end: now });
// data.dataPoints, data.time, data.values
```

</details>

<details>
<summary><strong><code>lm.getProperty(device, name, fallback)</code></strong></summary>

Reads a property from a device object that was fetched with property fields. Searches `customProperties`, `systemProperties`, `autoProperties`, then `inheritedProperties`, in that order, and returns the first match. Returns `fallback` if not found. This is synchronous and makes no request.

```js
var device = await lm.getDevice(42, { fields: "id,customProperties,systemProperties,autoProperties,inheritedProperties" });
var site = lm.getProperty(device, "location", "Unknown");
```

</details>

<details>
<summary><strong><code>lm.getStatusColor(status, fallback)</code></strong></summary>

Returns LogicMonitor's color for a status. Matching ignores case and surrounding whitespace.

| Status | Color |
| --- | --- |
| Critical | `#DA331A` |
| Error | `#F57202` |
| Warning | `#F5CA1E` |
| SDT | `#74D4E5` |
| Acknowledged | `#AD36BF` |
| Cleared, None | `#6BAE3A` |

Aliases `warn`, `ack`, `acked` and `clear` are accepted. Numeric alert severities are accepted too, as a number or numeric string: `2` Warning, `3` Error, `4` Critical. Unknown values return `fallback` (default `null`).

```js
lm.getStatusColor("critical");      // "#DA331A"
lm.getStatusColor(3);               // "#F57202"
lm.getStatusColor("bogus", "#999"); // "#999"
row.style.backgroundColor = lm.getStatusColor(alert.severity, "transparent");
```

</details>

<details>
<summary><strong><code>lm.getWidgetData(widgetId, opts)</code> (async)</strong></summary>

Returns the data behind a dashboard widget.

| Option | Description |
| --- | --- |
| `start`, `end` | Time range in epoch seconds. |
| `signal` | An `AbortSignal`. |

```js
var data = await lm.getWidgetData(1234);
```

</details>

### Context Helpers

Useful helpers for capturing information about a widget itself and the dashboard it's running in.

**Read only with respect to the portal:** these helpers make no API calls. Most only read the page. The exceptions that change the page (cookies, styles, iframe size) are `setCookie`, `deleteCookie`, `injectParentStyle`, `injectStyle`, `setStyleIfChanged`, `resizeFrame`, `onReady` and `observeSize`; they affect the browser only.

Each returns `null`, `''` or `false` instead of throwing when the parent page is unreachable. Reading or styling the parent page requires the portal's **Allow Scripts in Dashboard Text Widgets** setting, and the iframe must be same-origin with the portal.

| Function | Purpose |
| --- | --- |
| `dashboardId()`, `portal()` | Current dashboard id and portal host name. |
| `isEmbedded()`, `parentDocument()` | Whether the parent page is readable, and its document. |
| `widgetFrame()`, `widgetElement()`, `widgetId()` | This widget's iframe, the element around it, and that element's id. |
| `widgetContainer()`, `widgetTitle()`, `widgetParent()` | The widget card, its title, and the grid cell holding it. |
| `globalData(path, fallback)` | Read from the portal's `LMGlobalData`. |
| `getToken(elementId, fallback)` | Read a widget token, ignoring unresolved placeholders. |
| `sanitizeId(id)`, `scopedKey(base)` | Build safe, per-widget keys. |
| `getCookie`, `setCookie`, `deleteCookie`, `getJsonCookie` | Cookie helpers. |
| `injectStyle(id, css)` | Add a style to this widget's own document. |
| `injectParentStyle(id, css)`, `setStyleIfChanged(el, prop, value)` | Style the parent page. |
| `contentHeight()`, `resizeFrame(px)`, `onReady(fn)`, `observeSize(fn, el)` | Size and lifecycle helpers. |

#### `lm.context.selectors`

An object holding the CSS selectors for LogicMonitor's generated markup. If a portal update breaks `widgetContainer()` or `widgetTitle()`, override them here.

| Key | Default | Used by |
| --- | --- | --- |
| `widget` | `div[id][class*="DashboardWidgetsGrid__StyledWidget"]` | `widgetContainer()` |
| `title` | `p.MuiTypography-root` | `widgetTitle()` |

```js
lm.context.selectors.title = "h2.newTitleClass";
```

<details>
<summary><strong><code>lm.context.contentHeight()</code></strong></summary>

Returns the height of this document's `<html>` element in pixels. Because `<html>` is auto-height, it reflects the real content height and can shrink as well as grow, unlike `scrollHeight`.

```js
var px = lm.context.contentHeight();
```

</details>

<details>
<summary><strong><code>lm.context.dashboardId()</code></strong></summary>

Returns the numeric id of the current dashboard, taken from the parent page's URL (for example `/dashboards-2338`), or `''` if it can't be determined.

```js
var id = lm.context.dashboardId();   // "2338"
var dashboard = await lm.getDashboard(id);
```

</details>

<details>
<summary><strong><code>lm.context.deleteCookie(name, path)</code></strong></summary>

Deletes a cookie (`path` defaults to `/`).

```js
var widgetId = lm.context.widgetId();
lm.context.deleteCookie("myPrefs_" + widgetId);
```

</details>

<details>
<summary><strong><code>lm.context.getCookie(name)</code></strong></summary>

Returns the decoded value of a cookie, or `null` if it doesn't exist.

```js
var widgetId = lm.context.widgetId();
var raw = lm.context.getCookie("myPrefs_" + widgetId);
```

</details>

<details>
<summary><strong><code>lm.context.getJsonCookie(name, fallback)</code></strong></summary>

Reads a cookie and parses it as JSON, returning `fallback` (default `null`) if the cookie is missing or isn't valid JSON.

```js
var key = lm.context.scopedKey("prefs");
lm.context.setCookie(key, { zoom: 5, layer: "traffic" });
var prefs = lm.context.getJsonCookie(key, { zoom: 3 });
lm.context.deleteCookie(key);
```

</details>

<details>
<summary><strong><code>lm.context.getToken(elementId, fallback)</code></strong></summary>

Reads the text of a hidden element that holds a widget token (for example `##apiKey##`). Returns `fallback` (default `null`) if the element is missing, empty, or still contains an unresolved placeholder.

```html
<div id="regionToken" style="display:none">##region##</div>
<script>
	var region = lm.context.getToken("regionToken", "us-east");
</script>
```

</details>

<details>
<summary><strong><code>lm.context.injectParentStyle(id, css)</code></strong></summary>

Adds a `<style>` element to the parent page once, identified by `id`. The widget's card lives in the parent page, outside your iframe, so rules that target it (for example hover effects) must go there. Returns `true` if the style exists afterward (including when it was already added), `false` if the parent isn't reachable.

```js
lm.context.injectParentStyle("myWidgetStyle", ".myWidget:hover { border: 1px solid #ddd !important; }");
lm.context.widgetContainer().classList.add("myWidget");
```

To style content your widget renders itself, use `lm.context.injectStyle` instead: a style added to the parent page cannot reach inside the widget's iframe.

</details>

<details>
<summary><strong><code>lm.context.injectStyle(id, css)</code></strong></summary>

Adds a `<style>` element to this widget's own document once, identified by `id`. Use it to style the content your widget renders (tables, lists and so on), including overriding LogicMonitor's default text widget styles. Rules that target the widget card or other parent page elements belong in `injectParentStyle` instead, because CSS does not cross the iframe boundary in either direction. Returns `true` if the style exists afterward (including when it was already added), `false` if the document is unavailable.

```js
lm.context.injectStyle("deviceTableStyle", "#deviceList table, #deviceList th, #deviceList td { border: 1px solid #ccc; }");
```

</details>

<details>
<summary><strong><code>lm.context.isEmbedded()</code></strong></summary>

Returns `true` when the script runs inside an iframe whose parent page is readable. Returns `false` when it runs standalone or the parent is cross-origin.

```js
if (!lm.context.isEmbedded()) lm.warn("Running outside a dashboard; parent helpers are unavailable.");
```

</details>

<details>
<summary><strong><code>lm.context.observeSize(fn, element)</code></strong></summary>

Watches an element (default the `<html>` element) for size changes with a `ResizeObserver` and calls `fn` once per animation frame, no matter how many resize notifications arrive. Returns a function that stops observing. Returns a no-op function if `ResizeObserver` is unavailable.

```js
var stop = lm.context.observeSize(function () {
	lm.context.resizeFrame(lm.context.contentHeight());
});
// stop();
```

</details>

<details>
<summary><strong><code>lm.context.onReady(fn)</code></strong></summary>

Calls `fn` once the document has loaded, or immediately if it already has. This is very useful if your script performs any DOM lookups (example: `document.getElementById("resourceSelect")`) since LogicMonitor Text widgets may start to run the script before the widget's elements are fully rendered.

```js
lm.context.onReady(function () { init(); });
```

</details>

<details>
<summary><strong><code>lm.context.parentDocument()</code></strong></summary>

Returns the dashboard page's `document`, or `null` when not embedded.

```js
var doc = lm.context.parentDocument();
var gridCount = doc ? doc.querySelectorAll("iframe").length : 0;
```

</details>

<details>
<summary><strong><code>lm.context.portal()</code></strong></summary>

Returns the portal host name.

```js
lm.context.portal();   // "company.logicmonitor.com"
```

</details>

<details>
<summary><strong><code>lm.context.resizeFrame(height)</code></strong></summary>

Sets this widget's iframe height in pixels (rounded, never negative), only if it changed. Returns `true` when the height changed.

```js
lm.context.resizeFrame(lm.context.contentHeight());
```

</details>

<details>
<summary><strong><code>lm.context.sanitizeId(id)</code></strong></summary>

Replaces every character other than letters, digits, `_` and `-` with `_`, so a value is safe in a cookie name or key.

```js
lm.context.sanitizeId("widget 12:3");   // "widget_12_3"
```

</details>

<details>
<summary><strong><code>lm.context.scopedKey(base)</code></strong></summary>

Builds a key unique to the current dashboard and widget: `base_dashboardId_widgetId` (`default` replaces the dashboard id when unknown, and the widget part is omitted when unknown). Use it so several widgets, or several copies of one widget, don't overwrite each other's saved settings.

```js
var key = lm.context.scopedKey("mapOptions");   // "mapOptions_2338_w123"
```

</details>

<details>
<summary><strong><code>lm.context.setCookie(name, value, opts)</code></strong></summary>

Writes a cookie. Non-string values are stored as JSON.

| Option | Default | Description |
| --- | --- | --- |
| `maxAge` | one year | Lifetime in seconds. |
| `path` | `/` | Cookie path. |
| `sameSite` | `Lax` | SameSite attribute. |

```js
var widgetId = lm.context.widgetId();
lm.context.setCookie("myPrefs_" + widgetId, { zoom: 5 }, { maxAge: 86400 });
```

</details>

<details>
<summary><strong><code>lm.context.setStyleIfChanged(element, property, value)</code></strong></summary>

Sets an inline style (camelCase property) only if it differs from the current value, and returns `true` when it changed something. Avoids needless layout and resize cycles, especially inside size observers.

```js
lm.context.setStyleIfChanged(card, "height", "80px");
```

</details>

<details>
<summary><strong><code>lm.context.widgetContainer()</code></strong></summary>

Returns the outer styled widget card in the parent page. This is the element to style when you want to change how the widget looks (background, border, height). If LogicMonitor's markup no longer matches `lm.context.selectors.widget`, it falls back to `widgetElement()`.

```js
var card = lm.context.widgetContainer();
if (card) card.style.backgroundColor = "unset";
```

</details>

<details>
<summary><strong><code>lm.context.widgetElement()</code></strong></summary>

Returns the nearest element with an `id` that contains the widget iframe, or `null`.

```js
var element = lm.context.widgetElement();
```

</details>

<details>
<summary><strong><code>lm.context.widgetFrame()</code></strong></summary>

Returns this widget's `<iframe>` element in the parent page. Uses `window.frameElement` and falls back to searching the parent page for the iframe whose window is this one. Returns `null` when unavailable.

```js
var frame = lm.context.widgetFrame();
if (frame) frame.style.border = "none";
```

</details>

<details>
<summary><strong><code>lm.context.widgetId()</code></strong></summary>

Returns the `id` of that element (the widget id), or `null`.

```js
var widgetId = lm.context.widgetId();
```

</details>

<details>
<summary><strong><code>lm.context.widgetParent()</code></strong></summary>

Returns the parent element of the widget card (the dashboard grid cell), or `null`.

```js
var cell = lm.context.widgetParent();
if (cell) cell.style.alignItems = "flex-end";
```

</details>

<details>
<summary><strong><code>lm.context.widgetTitle()</code></strong></summary>

Returns the widget's title element in the parent page, or `null`.

```js
var title = lm.context.widgetTitle();
if (title) title.style.fontSize = "xx-large";
```

</details>

### Logging


Messages go to the browser console with a `[widgetName]` prefix, any registered transports, and optionally LM Logs. Entries are redacted before they go anywhere: bearer tokens and LMv1 headers in messages are replaced, and metadata keys such as `token`, `secret`, `password`, `authorization`, `accessKey` and `apiKey` are masked.

**Writes log data only:** console logging has no portal effect. With LM Logs forwarding enabled, entries are `POST`ed to LM Logs (the only non-`GET` request the SDK sends on its own). It never changes portal configuration.

| Function | Purpose |
| --- | --- |
| `lm.debug`, `lm.info`, `lm.warn`, `lm.error` | Write a message at that level. |
| `lm.setLevel`, `lm.getLevel` | Set or read the minimum level written. |
| `lm.logger.addTransport` | Add a custom destination. |
| `lm.logger.flush` | Send queued LM Logs entries now. |

<details>
<summary><strong><code>lm.debug(message, meta)</code>, <code>lm.info(message, meta)</code>, <code>lm.warn(message, meta)</code>, <code>lm.error(message, meta)</code></strong></summary>

Write a message at that level. `message` can be a string, an `Error` or any object (non-strings are converted to text). `meta` is optional structured data shown next to the message in the console and sent with LM Logs entries. Messages below the current level are ignored.

```js
lm.debug("Raw response", response);
lm.info("Loaded " + devices.length + " devices");
lm.warn("Device has no location property", { deviceId: 42 });
try {
	await lm.getDevice(1);
} catch (e) {
	lm.error(e, { step: "load device" });
}
```

</details>

<details>
<summary><strong><code>lm.logger.addTransport(fn)</code></strong></summary>

Registers a custom destination. `fn` receives each entry that passes the level filter: `{ level, msg, timestamp, widget, meta }`. Exceptions thrown by a transport are ignored so they can never break the widget. Returns a function that removes the transport.

```js
var remove = lm.logger.addTransport(function (entry) {
	if (entry.level === "error") errorBanner.textContent = entry.msg;
});
// remove();
```

</details>

<details>
<summary><strong><code>lm.setLevel(level)</code> / <code>lm.getLevel()</code></strong></summary>

`setLevel` sets the minimum level written: `'debug'`, `'info'`, `'warn'`, `'error'` or `'silent'`. It returns `lm`, and throws an `LMError` for an unknown level. `getLevel` returns the current level name. The default is `'info'`.

```js
lm.setLevel("debug");
lm.getLevel();   // "debug"
```

</details>

#### LM Logs forwarding

To keep log messages, configure your widget to forward them to LM Logs using the following:

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

| `logs` option | Default | Description |
| --- | --- | --- |
| `enabled` | `false` | Turns forwarding on. |
| `resourceId` | `null` | Required. Properties that identify a monitored resource, sent as `_lm.resourceId`. Without it, entries are dropped with one console warning. |
| `batchSize` | `50` | Send when this many entries are queued. |
| `flushMs` | `5000` | Send after this many milliseconds if the batch isn't full. |
| `maxQueue` | `1000` | Oldest entries are dropped beyond this. |
| `endpoint` | `/rest/log/ingest` | Ingest URL. |
| `signPath` | `/log/ingest` | Path used to sign LMv1 requests. |

Entries are batched and POSTed to the ingest endpoint, and flushed on batch size, the timer, `pagehide` and `visibilitychange`. Failed batches are dropped with a single console warning. The ingest endpoint requires bearer or LMv1 credentials with log ingest permission; it may not accept integrated session auth.

<details>
<summary><strong><code>lm.logger.flush()</code> (async)</strong></summary>

Sends the queue immediately and resolves to `true` when the batch was sent (or there was nothing to send) and `false` on failure. You rarely need it, but it is useful before navigating away.

```js
lm.info("Widget finished loading");
var ok = await lm.logger.flush();
```

</details>

### Utilities

General-purpose helpers useful during widget development. All are read only.

| Function | Purpose |
| --- | --- |
| `lm.buildFilterValue(value)` | Quote a value for a raw filter string. |
| `lm.debounce(fn, delay)` | Delay a function until calls stop. |
| `lm.escapeHtml(value)` | Escape text for safe insertion into HTML. |
| `lm.formatDate(epoch)` | Format epoch seconds or milliseconds as local time. |
| `lm.isTruthy(value)` | Interpret `true`, `yes`, `y`, `1` and `on` as true. |
| `lm.nil(value)` | True for null, empty or unresolved `##token##` values. |
| `lm.sleep(ms, signal)` | Promise that resolves after a delay. |

<details>
<summary><strong><code>lm.buildFilterValue(value)</code></strong></summary>

Formats a value as the right-hand side of a LogicMonitor filter term. Numbers and booleans are returned bare; everything else is converted to a string, wrapped in double quotes, with backslashes and quotes escaped. The query builder uses this internally; use it when assembling a raw filter string by hand.

```js
lm.buildFilterValue(5);          // 5
lm.buildFilterValue('a"b');      // "a\"b"
var filter = "displayName:" + lm.buildFilterValue(userInput);
```

</details>

<details>
<summary><strong><code>lm.debounce(fn, delay = 300)</code></strong></summary>

Returns a wrapper that calls `fn` only after `delay` milliseconds have passed without another call, using the most recent arguments. The wrapper has a `cancel()` method that drops a pending call, for example when the widget is torn down.

```js
var refresh = lm.debounce(loadDevices, 500);
searchBox.addEventListener("input", refresh);
// refresh.cancel();
```

</details>

<details>
<summary><strong><code>lm.escapeHtml(value)</code></strong></summary>

Escapes `&`, `<`, `>`, `"` and `'` so a value can be inserted into HTML as text. `null` and `undefined` become an empty string. Use it before building HTML with `innerHTML` from API data such as device names.

```js
el.innerHTML = "<b>" + lm.escapeHtml(device.displayName) + "</b>";
```

</details>

<details>
<summary><strong><code>lm.formatDate(epoch)</code></strong></summary>

Formats an epoch timestamp as a local date and time string (`toLocaleString`). Values below `1e12` are treated as seconds, which is what the LogicMonitor API returns; larger values are treated as milliseconds. Invalid, zero or negative input returns an empty string.

```js
lm.formatDate(1700000000);      // seconds, as returned by alerts (startEpoch)
lm.formatDate(Date.now());      // milliseconds
lm.formatDate("bad");           // ""
```

</details>

<details>
<summary><strong><code>lm.isTruthy(value)</code></strong></summary>

Returns `true` for `true` or the strings `true`, `yes`, `y`, `1` and `on` (case-insensitive, trimmed). Everything else, including nil values and unresolved placeholders, returns `false`. Handy for checkbox-style widget tokens.

```js
lm.isTruthy("Yes");            // true
lm.isTruthy("off");            // false
lm.isTruthy("##showLegend##"); // false
```

</details>

<details>
<summary><strong><code>lm.nil(value)</code></strong></summary>

Returns `true` when the value is `null`, `undefined`, an empty or whitespace-only string, or an unresolved `##token##` placeholder. Use it to test widget token values. Numbers, `0` and `false` are not nil.

```js
lm.nil("");               // true
lm.nil("##apiKey##");     // true (placeholder LogicMonitor did not replace)
lm.nil("abc");            // false
lm.nil(0);                // false
```

</details>

<details>
<summary><strong><code>lm.sleep(ms, signal)</code></strong></summary>

Returns a promise that resolves after `ms` milliseconds. If an optional `AbortSignal` aborts first, the promise rejects with an `AbortError`. Use it for polling loops and manual backoff.

```js
await lm.sleep(2000);
await lm.sleep(10000, controller.signal);   // rejects if controller.abort() is called
```

</details>
