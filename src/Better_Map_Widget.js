// Better Map Widget
// Developed by Kevin Ford
// Version 2.97 - Integrated Authentication Version
// Integrated authentication improvements by Steve Villardi

// Some of the ideas behind this project:
// * Support for thousands pins on the map, though be aware that Google Maps will start to struggle if too many pins.
// * Adjacent pins get grouped/clustered together for a cleaner map display.
// * Clusters use a donut chart to represent the severities of the grouped markers.
// * Easy toggling of weather layers.
// * Display more information when clicking a marker.

// ------------------------------------------------------------
// Default values for the widget if not already set by the calling HTML...

// Whether we're plotting "groups" or "resources" or "services" (strongly recommend staying with groups or services)...
// You can either set it here or in a dashboard token named 'MapSourceType'...
if (typeof mapSourceType === 'undefined') { let mapSourceType = "groups"; };

// Preferred map style. Available options: "silver" (the default), "standard", "dark", "aubergine", or "silverblue"...
if (typeof mapStyle === 'undefined') { let mapStyle = "silverblue"; };

// Whether to ignore items with no active alerts (useful for maps with thousands of markers)...
// You can either set it here or in a dashboard token named 'MapIgnoreCleared'...
if (typeof showCleared === 'undefined') { let showCleared = true; };
if (typeof showWarnings === 'undefined') { let showWarnings = true; };
if (typeof showErrors === 'undefined') { let showErrors = true; };
if (typeof showCriticals === 'undefined') { let showCriticals = true; };
if (typeof showSDT === 'undefined') { let showSDT = true; };

// Capture if a group filter...
// You can set it here or in a dashboard token named "MapGroupPathFilter"...
if (typeof groupPathFilter === 'undefined') { let groupPathFilter = "*"; };

// Interval for updating group status data (in minutes)...
if (typeof statusUpdateIntervalMinutes === 'undefined') { let statusUpdateIntervalMinutes = 2; };

// Flag to disable marker clustering if needed...
if (typeof disableClustering === 'undefined') { let disableClustering = false; };

// Whether to show weather by default. Options are: "no", "global", "nexrad"...
// You can set it here or in a dashboard token named "MapShowWeather"...
if (typeof showWeatherDefault === 'undefined') { let showWeatherDefault = "no"; };

// If weather is shown, whether to show "wildfires" or "outages" or "earthquakes"...
// You can set it here or in a dashboard token named "MapOverlayOption"...
if (typeof additionalOverlayOption === 'undefined') { let additionalOverlayOption = "earthquakes"; };

// Whether to show or hide the map options along the top of the widget by default...
// You can set it here or in a dashboard token named "HideMapOptions"...
if (typeof hideMapOptionsByDefault === 'undefined') { let hideMapOptionsByDefault = false; };

// Whether to automatically center the map to encompass all items during timed refreshes...
// You can set it here or in a dashboard token named "AutoResetMapOnRefresh"...
if (typeof autoResetMapOnRefresh === 'undefined') { let autoResetMapOnRefresh = false; };

// When true will not refresh the data on a timed interval (useful ONLY during development)...
if (typeof developmentFlag === 'undefined') { let developmentFlag = false; };

// Since we generally don't need to poll all properties every time, we can just grab them initially then occasionally every x number of polls based on the following variable (set to 0 to perform a full refresh every time)...
if (typeof fullRefreshInterval === 'undefined') { const fullRefreshInterval = 0; };

// Optional angle & heading for the Google Map...
if (typeof showMapTiltControls === 'undefined') { let showMapTiltControls = false; };
if (typeof mapTilt === 'undefined') { let mapTilt = 0; };
if (typeof mapHeading === 'undefined') { let mapHeading = 0; };

// Whether to include inherited locations in addition to those directly set on resources and/or services (disabling this can greatly increase refresh speed)...
if (typeof pollInheritedLocations === 'undefined') { const pollInheritedLocations = true; };

// Typically if both a 'latitude' & 'longitude' property are set, then we can assume the address is already geocoded. Set this to "true" to force geocoding the address instead...
if (typeof ignoreLatLongProps === 'undefined') { const ignoreLatLongProps = false; };

// Whether the Google Maps uses the "cooperative" gesture handling, or "greedy" that allows mouse-wheel zooming without having to hold a modifier key (Google's default is "cooperative")...
if (typeof mapGestureHandling === 'undefined') { const mapGestureHandling = "cooperative"; };
// Whether to show road labels...
if (typeof showRoadLabels === 'undefined') { let showRoadLabels = "off"; };

// An optional comma-delimited list of custom properties to show when viewing a group's/resource's details...
// You can set it here or in a dashboard token named "MapDisplayProperties"...
if (typeof displayProps === 'undefined') { let displayProps = ""; };

// Property to look for connecting information in...
if (typeof connectionInfoProp === 'undefined') { const connectionInfoProp = "auto.custom_map_connection_data"; };
// Stroke weight of connecting lines...
if (typeof connectingLineWeight === 'undefined') { const connectingLineWeight = 3; };
// Whether to use geodesic lines when connecting two locations (I recommend not so it just plots a straight line vs curve of the Earth)...
if (typeof useGeodesicLines === 'undefined') { const useGeodesicLines = false; };

// Default opacity for weather layers...
if (typeof weatherOpacity === 'undefined') { const weatherOpacity = 0.2; };
// Weather refresh interval in minutes...
if (typeof weatherRefreshMinutes === 'undefined') { const weatherRefreshMinutes = 5; };
// Whether to display details about a wildfire on "click" or "mouseover"...
if (typeof showWildfireInfoEvent === 'undefined') { const showWildfireInfoEvent = "click"; };
// Whether the opacity of an earthquake's icon reflects "time" since the event, or "magnitude"...
if (typeof quakeMode === 'undefined') { let quakeMode = "time"; };

// ------------------------------------------------------------

// Capture information from specific dashboard tokens we'll be using...
// (Like any token inserted into the Text widget, LogicMonitor automatically inserts these token values as the page is being rendered so Javascript is able to pick them as if the values were there originally. If a token isn't set then the variable's value will be literally what's shown below, including the double-hashtags.)

// Capture from token whether to plot "groups" or "resources" or "services"...
let mapSourceTypeToken = document.getElementById("mapSourceTypeToken").innerText;
// If the token value wasn't set then use the values hard-coded above at the beginning of this script...
// if (mapSourceTypeToken != "\#\#MapSourceType\#\#") {
if (mapSourceTypeToken != "##MapSourceType##") {
	mapSourceType = mapSourceTypeToken.toLowerCase();
};
// console.debug("mapSourceTypeToken", mapSourceTypeToken);

// Capture from token whether override the map theme...
let mapStyleToken = document.getElementById("mapStyleToken").innerText;
// If the token value wasn't set then use the values hard-coded above at the beginning of this script...
if (mapStyleToken != "##MapStyle##") {
	mapStyle = mapStyleToken.toLowerCase();
};
// console.debug("mapStyleToken", mapStyleToken);

// Capture from token whether to hide the map options...
let hideMapOptionsByDefaultToken = document.getElementById("hideMapOptionsByDefaultToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (hideMapOptionsByDefaultToken.toLowerCase() == "true" || hideMapOptionsByDefaultToken.toLowerCase() == "yes"|| hideMapOptionsByDefaultToken.toLowerCase() == "1") {
	hideMapOptionsByDefault = true;
};
// console.debug("hideMapOptionsByDefaultToken", hideMapOptionsByDefaultToken);

// Capture from token whether to hide items that don't have active alerts...
let ignoreClearedToken = document.getElementById("ignoreClearedToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (ignoreClearedToken.toLowerCase() == "true" || ignoreClearedToken.toLowerCase() == "yes" || ignoreClearedToken.toLowerCase() == "1") {
	showCleared = false;
};
// Capture from token whether to hide items that have "Warning" alerts...
let ignoreWarningsToken = document.getElementById("ignoreWarningsToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (ignoreWarningsToken.toLowerCase() == "true" || ignoreWarningsToken.toLowerCase() == "yes" || ignoreWarningsToken.toLowerCase() == "1") {
	showWarnings = false;
};
// Capture from token whether to hide items that have "Error" alerts...
let ignoreErrorsToken = document.getElementById("ignoreErrorsToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (ignoreErrorsToken.toLowerCase() == "true" || ignoreErrorsToken.toLowerCase() == "yes" || ignoreErrorsToken.toLowerCase() == "1") {
	showErrors = false;
};
// Capture from token whether to hide items that have "Critical" alerts...
let ignoreCriticalsToken = document.getElementById("ignoreCriticalsToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (ignoreCriticalsToken.toLowerCase() == "true" || ignoreCriticalsToken.toLowerCase() == "yes" || ignoreCriticalsToken.toLowerCase() == "1") {
	showCriticals = false;
};
// Capture from token whether to hide items that are in SDT...
let ignoreSDTToken = document.getElementById("ignoreSDTToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (ignoreSDTToken.toLowerCase() == "true" || ignoreSDTToken.toLowerCase() == "yes" || ignoreSDTToken.toLowerCase() == "1") {
	showSDT = false;
};
// Capture from token whether to show the map tilt/rotation controls...
let showMapTiltControlsToken = document.getElementById("showMapTiltControlsToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (showMapTiltControlsToken.toLowerCase() == "true" || showMapTiltControlsToken.toLowerCase() == "yes" || showMapTiltControlsToken.toLowerCase() == "1") {
	showMapTiltControls = true;
};
// console.debug("showMapTiltControlsToken", showMapTiltControlsToken);
// Capture from token whether to automatically reset the map's zoom to encompass all items on timed refreshes...
let autoResetMapOnRefreshToken = document.getElementById("autoResetMapOnRefreshToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (autoResetMapOnRefreshToken.toLowerCase() == "true" || autoResetMapOnRefreshToken.toLowerCase() == "yes" || autoResetMapOnRefreshToken.toLowerCase() == "1") {
	autoResetMapOnRefresh = true;
};
// console.debug("autoResetMapOnRefreshToken", autoResetMapOnRefreshToken);
// Capture our group filter if defined as a token...
let dashboardGroupPathToken = document.getElementById("dashboardGroupPathToken").innerText;
if (dashboardGroupPathToken != "##MapGroupPathFilter##") {
	groupPathFilter = dashboardGroupPathToken;
};
if (groupPathFilter == "") {
	// Default to "*" if no value was given...
	groupPathFilter = "*";
};
// Capture the current path filter to reset the form field if the user completely clears it out...
const initialGroupPathFilter = groupPathFilter;
// console.debug("dashboardGroupPathToken", dashboardGroupPathToken);
// Capture our overlay defaults if defined as tokens...
let dashboardShowWeatherToken = document.getElementById("dashboardShowWeatherToken").innerText.toLowerCase();
if (dashboardShowWeatherToken == "global" || dashboardShowWeatherToken == "nexrad") {
	showWeatherDefault = dashboardShowWeatherToken;
};
let dashboardAddlOverlayToken = document.getElementById("dashboardAddlOverlayToken").innerText.toLowerCase();
if (dashboardAddlOverlayToken == "wildfires" || dashboardAddlOverlayToken == "outages" || dashboardAddlOverlayToken == "earthquakes") {
	additionalOverlayOption = dashboardAddlOverlayToken;
};
// console.debug("dashboardAddlOverlayToken", dashboardAddlOverlayToken);
// Capture from token any custom properties to display when viewing an item's details...
let displayPropsToken = document.getElementById("displayPropsToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (displayPropsToken != "##MapDisplayProperties##") {
	displayProps = displayPropsToken;
};
// console.debug("displayPropsToken", displayPropsToken);
// Capture from token whether to disable marker clustering...
let disableClusteringToken = document.getElementById("disableClusteringToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (disableClusteringToken.toLowerCase() == "true" || disableClusteringToken.toLowerCase() == "yes" || disableClusteringToken.toLowerCase() == "1") {
	disableClustering = true;
};
// console.debug("disableClusteringToken", disableClusteringToken);
// Capture from token whether to show road labels...
let showRoadLabelsToken = document.getElementById("showRoadLabelsToken").innerText;
// If the token value wasn't set then use the value hard-coded above at the beginning of this script...
if (showRoadLabelsToken.toLowerCase() == "true" || showRoadLabelsToken.toLowerCase() == "yes" || showRoadLabelsToken.toLowerCase() == "1") {
	showRoadLabels = "yes";
};

// ------------------------------------------------------------
// Initialize Google Maps...

// Fetch our map API key to use...
let apiKey = parent.LMGlobalData.googleMapInfo.key.toString();

(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})
({key: apiKey, v: "weekly"});

// ------------------------------------------------------------
// CSRF Token caching for performance optimization
let _cachedCsrfToken = null;
let _csrfTokenExpiry = 0;
const CSRF_TOKEN_TTL = 5 * 60 * 1000; // Cache token for 5 minutes

// AbortController for canceling in-progress refresh operations
let _currentRefreshController = null;

// Utility: Debounce function for rate-limiting user input handlers
function debounce(fn, delay = 300) {
	let timeoutId;
	return (...args) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
}

/**
* Fetches a Cross-Site Request Forgery (CSRF) token required for subsequent API calls.
* Implements caching to avoid redundant network requests within the TTL period.
*
* This function makes a preliminary request to a dummy endpoint solely to retrieve
* the CSRF token from the response headers.
*
* @async
* @function fetchCsrfToken
* @param {boolean} [forceRefresh=false] - Force a fresh token fetch, bypassing the cache.
* @returns {Promise<string>} A promise that resolves with the CSRF token.
* @throws {Error} If the fetch request fails or the token is not found in headers.
*/
async function fetchCsrfToken(forceRefresh = false) {
	// Return cached token if still valid and not forcing refresh
	if (!forceRefresh && _cachedCsrfToken && Date.now() < _csrfTokenExpiry) {
		// console.debug('Using cached CSRF token...');
		return _cachedCsrfToken;
	}

	// console.debug('Fetching fresh CSRF token...');
	const response = await fetch('/santaba/rest/functions/dummy', {
		method: 'GET',
		headers: {
			'X-Csrf-Token': 'Fetch', // Specific header to request the token
			'Accept': 'application/json',
			'X-Version': '3', // Specify API version if required by this endpoint
		},
		credentials: 'include', // Include cookies for session management/CSRF
	});

	if (!response.ok) {
		// Clear cache on failure
		_cachedCsrfToken = null;
		_csrfTokenExpiry = 0;
		throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
	}

	const token = response.headers.get('X-Csrf-Token');
	if (!token) {
		throw new Error('CSRF token not found in response headers.');
	}

	// Cache the token
	_cachedCsrfToken = token;
	_csrfTokenExpiry = Date.now() + CSRF_TOKEN_TTL;
	// console.debug('CSRF Token fetched and cached successfully.');

	return token;
}

/**
	* Performs an HTTP request to the LogicMonitor REST API.
	*
	* This function handles fetching a CSRF token, constructing the API request,
	* sending the request, and processing the response. It supports common HTTP verbs
	* and automatically includes necessary headers and credentials.
	*
	* @async
	* @function LMClient
	* @param {object} options - The options for the API request.
	* @param {string} options.resourcePath - The specific API resource path (e.g., /device/devices).
	* @param {string} [options.queryParams=''] - Optional query parameters string (e.g., ?filter=name:value).
	* @param {'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'} options.httpVerb - The HTTP method to use.
	* @param {object | Array<unknown>} [options.postBody] - The JSON payload for POST/PUT/PATCH requests.
	* @param {string} [options.apiVersion='3'] - The API version to use. Default is "3".
	* @param {AbortSignal} [options.signal] - Optional AbortSignal for canceling the request.
	* @returns {Promise<object>} A promise that resolves with the JSON response body on success.
	* @throws {Error} Throws an Error on API errors (>=300 status), network issues,
	*                 token fetching problems, or JSON handling errors. The error object
	*                 may contain 'status' and 'statusText' properties for API errors.
*/
async function LMClient({
	resourcePath,
	queryParams = '', // Default queryParams to empty string
	httpVerb,
	postBody,
	apiVersion = '3',
	signal = null, // Optional AbortSignal for request cancellation
}) {
	// console.debug('LMClient called with:', { resourcePath, queryParams, httpVerb, postBody, apiVersion });
	// Validate required parameters
	if (!resourcePath || !httpVerb) {
		throw new Error('Missing required parameters: resourcePath and httpVerb must be provided.');
	}
	const validVerbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
	if (!validVerbs.includes(httpVerb)) {
		throw new Error(`Invalid httpVerb: ${httpVerb}. Must be one of ${validVerbs.join(', ')}`);
	}

	// console.debug(`Initiating LogicMonitor API call: ${httpVerb} ${resourcePath}${queryParams}`);

	try {
		// 1. Fetch the CSRF token
		const csrfToken = await fetchCsrfToken();

		// 2. Construct the API URL and request options
		const apiUrl = `/santaba/rest${resourcePath}${queryParams}`;
		const headers = {
			'Content-Type': 'application/json', // Consistently set Content-Type
			'Accept': 'application/json', // Expect JSON response
			'X-Csrf-Token': csrfToken,
			'X-Version': apiVersion, // Use the appropriate API version for the main request
		};

		const requestOptions = {
			method: httpVerb,
			headers: headers,
			credentials: 'include', // Necessary for session/cookie-based auth
		};

		// Add AbortSignal if provided
		if (signal) {
			requestOptions.signal = signal;
		}

		// 3. Add body only for relevant methods
		if (postBody && (httpVerb === 'POST' || httpVerb === 'PUT' || httpVerb === 'PATCH')) {
			try {
				requestOptions.body = JSON.stringify(postBody);
				// console.debug('Request body included:', postBody);
			} catch (stringifyError) {
				console.error('Failed to stringify postBody:', stringifyError);
				// Add user-friendly message to the error
				stringifyError.message = `Invalid postBody provided. Could not stringify to JSON. Original error: ${stringifyError.message}`;
				throw stringifyError;
			}
		}

		// 4. Make the API call
		// console.debug(`Executing fetch to: ${apiUrl}`);
		const response = await fetch(apiUrl, requestOptions);
		// console.debug(`Received response status: ${response.status} ${response.statusText}`);

		// 5. Process the response
		if (response.ok) { // ok is true for statuses 200-299
			// Handle potential empty response body for certain success statuses (e.g., 204 No Content)
			if (response.status === 204) {
				console.debug('Received 204 No Content response.');
				return {}; // Return an empty object for 204
			}
			try {
				// Assume response is JSON if status is ok and not 204
				const data = await response.json();
				// console.debug('API call successful, response data received.'); // Avoid logging potentially sensitive data by default
				return data;
			} catch (jsonError) {
				console.error('Failed to parse JSON response:', jsonError);
				// Create a new error with more context
				const parseError = new Error(`Successfully received response (${response.status}), but failed to parse JSON body. Original error: ${jsonError.message}`);
				parseError.status = response.status; // Attach status for context
				parseError.statusText = response.statusText;
				throw parseError;
			}
		} else {
			// Handle API errors (status >= 300)
			const error = new Error(`API Error: ${response.status} ${response.statusText}`);
			error.status = response.status;
			error.statusText = response.statusText;

			// Attempt to get more details from the error response body
			try {
				const errorBody = await response.text(); // Use text first in case it's not JSON
				error.body = errorBody || 'No additional error details provided.'; // Attach body to error
				console.warn(`API Error Body: ${error.body}`); // Log the raw error body
			} catch (bodyError) {
				console.warn('Could not read error response body:', bodyError);
				error.body = 'Could not read error response body.';
			}
			console.error('LogicMonitor API Error:', { status: error.status, statusText: error.statusText });
			throw error; // Throw the augmented error object
		}
	} catch (error) {
		// Catch errors from fetchCsrfToken, fetch itself (network errors), or JSON parsing/stringifying
		console.error('An error occurred in LMClient:', error.message || error);

		// Re-throw the error to be handled by the caller.
		// Ensure it's always an Error object.
		if (error instanceof Error) {
			throw error;
		} else {
			// If it's not an Error object (e.g., the thrown API error object), wrap it
			const wrappedError = new Error(error.message || 'An unexpected error occurred during the API call.');
			// Copy relevant properties if they exist
			if (error && typeof error === 'object') {
				if ('status' in error) wrappedError.status = error.status;
				if ('statusText' in error) wrappedError.statusText = error.statusText;
				if ('body' in error) wrappedError.body = error.body;
			}
			throw wrappedError;
		}
	}
};

// ------------------------------------------------------------

// Cache frequently accessed DOM elements for performance
const _dom = {
	showCleared: document.getElementById("showCleared"),
	showWarnings: document.getElementById("showWarnings"),
	showErrors: document.getElementById("showErrors"),
	showCriticals: document.getElementById("showCriticals"),
	showSDT: document.getElementById("showSDT"),
	autoZoom: document.getElementById("autoZoom"),
	weather: document.getElementById("weather"),
	globalWeather: document.getElementById("globalWeather"),
	nexradWeather: document.getElementById("nexradWeather"),
	usWildfires: document.getElementById("usWildfires"),
	usPowerOutages: document.getElementById("usPowerOutages"),
	earthquakes: document.getElementById("earthquakes"),
	customGroupFilterField: document.getElementById("customGroupFilterField"),
	mapOptionsArea: document.getElementById("mapOptionsArea"),
	refreshStatusArea: null, // Set later after map init
	weatherRefreshButton: null, // Set later after map init
	showClearedLabel: document.getElementById("showClearedLabel"),
	showWarningsLabel: document.getElementById("showWarningsLabel"),
	showErrorsLabel: document.getElementById("showErrorsLabel"),
	showCriticalsLabel: document.getElementById("showCriticalsLabel"),
	showSDTLabel: document.getElementById("showSDTLabel"),
};

// Set the form fields as appropriate...
_dom.showCleared.checked = showCleared;
_dom.showWarnings.checked = showWarnings;
_dom.showErrors.checked = showErrors;
_dom.showCriticals.checked = showCriticals;
_dom.showSDT.checked = showSDT;
_dom.autoZoom.checked = autoResetMapOnRefresh;

if (showWeatherDefault == "global") {
	_dom.weather.checked = true;
	_dom.globalWeather.checked = true;
} else if (showWeatherDefault == "nexrad") {
	_dom.weather.checked = true;
	_dom.nexradWeather.checked = true;
}
if (additionalOverlayOption == "wildfires") {
	_dom.usWildfires.checked = true;
} else if (additionalOverlayOption == "outages") {
	_dom.usPowerOutages.checked = true;
} else if (additionalOverlayOption == "earthquakes") {
	_dom.earthquakes.checked = true;
}

// Capture information about the current dashboard for use in subsequent REST calls...
const hostName = parent.window.location.host;
const locationHash = parent.window.location.hash; // example result: "#dashboard=21"
const dashboardID = locationHash.replace("#dashboard=", "");
const pathName = parent.window.location.pathname;

// Note our original tilt & heading values...
const defaultMapTilt = mapTilt;
const defaultMapHeading = mapHeading;

// SVG icon definitions for our different alert severities...
const warningIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024" data-tooltip="Warning"><path fill="#f5ca1d" d="M118.154 118.154h787.692c43.323 0 78.769 35.446 78.769 78.769v630.154c0 43.323-35.446 78.769-78.769 78.769h-787.692c-43.323 0-78.769-35.446-78.769-78.769v-630.154c0-43.323 35.446-78.769 78.769-78.769v0 0z"></path> <path fill="white" d="M866.462 669.538l-275.692-433.231c-43.323-70.892-114.215-70.892-157.538 0l-275.692 433.231c-43.323 70.892-3.938 157.538 78.769 157.538h551.385c82.708 0 122.092-86.646 78.769-157.538v0 0z"></path> <path fill="#f5ca1d" d="M551.385 748.308h-78.769v-78.769h78.769v78.769zM551.385 630.154h-78.769v-275.692h78.769v275.692z"></path> </svg>';
const errorIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024" data-tooltip="Error"><path fill="#ff8c00" d="M118.154 118.154h787.692c43.323 0 78.769 35.446 78.769 78.769v630.154c0 43.323-35.446 78.769-78.769 78.769h-787.692c-43.323 0-78.769-35.446-78.769-78.769v-630.154c0-43.323 35.446-78.769 78.769-78.769v0 0z"></path> <path fill="white" d="M866.462 669.538l-275.692-433.231c-43.323-70.892-114.215-70.892-157.538 0l-275.692 433.231c-43.323 70.892-3.938 157.538 78.769 157.538h551.385c82.708 0 122.092-86.646 78.769-157.538v0 0z"></path> <path fill="#ff8c00" d="M551.385 748.308h-78.769v-78.769h78.769v78.769zM551.385 630.154h-78.769v-275.692h78.769v275.692z"></path> </svg>';
const criticalIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024" data-tooltip="Critical"><path fill="#e0351b" d="M118.154 118.154h787.692c43.323 0 78.769 35.446 78.769 78.769v630.154c0 43.323-35.446 78.769-78.769 78.769h-787.692c-43.323 0-78.769-35.446-78.769-78.769v-630.154c0-43.323 35.446-78.769 78.769-78.769v0 0z"></path> <path fill="white" d="M827.077 590.769c-133.908-232.369-39.385-354.462-39.385-354.462s-173.292 43.323-157.538 157.538c-35.446-31.508-216.615-86.646-114.215-271.754v-3.938h-3.938c-3.938 0-55.138 23.631-94.523 74.831-39.385 47.262-110.277 106.338-63.015 240.246 31.508 74.831 39.385 94.523-39.385 157.538 3.938-15.754 11.815-51.2 0-78.769-27.569-63.015-78.769-78.769-78.769-78.769s43.323 66.954 0 118.154c-39.385 43.323-55.138 129.969-35.446 200.862 15.754 59.077 70.892 106.338 157.538 137.846-7.877-3.938 110.277 43.323 244.185 3.938 59.077-19.692 137.846-43.323 185.108-106.338 39.385-51.2 74.831-129.969 39.385-196.923v0 0z"></path> <path fill="#e0351b" d="M551.385 827.077h-78.769v-78.769h78.769v78.769zM551.385 708.923h-78.769v-275.692h78.769v275.692z"></path> </svg>';
const clearedIcon = '<svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" data-tooltip="No alerts"><path id="Shape" fill="#ffffff" fill-rule="evenodd" stroke="none" d="M 43 25 C 43 15.61116 35.164986 8 25.5 8 C 15.835016 8 8 15.61116 8 25 C 8 34.38884 15.835016 42 25.5 42 C 35.164986 42 43 34.38884 43 25 Z"/><path id="Path" fill="#85c25d" stroke="none" d="M 25.5 4 C 37.374119 4 47 13.625877 47 25.5 C 47 37.374123 37.374119 47 25.5 47 C 13.625877 47 4 37.374123 4 25.5 C 4 13.625877 13.625877 4 25.5 4 Z M 17.975 17.974998 C 15.881312 17.974998 14.103745 18.670809 12.642242 20.062449 C 11.18074 21.45409 10.45 23.269981 10.45 25.510181 C 10.45 27.736805 11.18074 29.545912 12.642242 30.937551 C 14.103745 32.329193 15.881312 33.025002 17.975 33.025002 C 20.068687 33.025002 21.842855 32.329193 23.297562 30.937551 C 24.752264 29.545912 25.479607 27.736805 25.479607 25.510181 C 25.479607 23.283558 24.752264 21.471062 23.297562 20.072632 C 21.842855 18.674204 20.068687 17.974998 17.975 17.974998 Z M 31.006098 18.280481 L 27.784012 18.280481 L 27.784012 32.719521 L 31.006098 32.719521 L 31.006098 28.850101 L 32.637535 27.037582 L 36.532589 32.719521 L 40.549999 32.719521 L 34.901154 24.532646 L 40.529606 18.280481 L 36.287876 18.280481 L 31.006098 24.34936 L 31.006098 18.280481 Z M 17.975 21.111265 C 19.089819 21.111265 20.061874 21.48802 20.891193 22.241541 C 21.72051 22.995064 22.135162 24.07781 22.135162 25.489815 C 22.135162 26.901821 21.72051 27.981174 20.891193 28.727909 C 20.061874 29.474642 19.089819 29.848003 17.975 29.848003 C 16.86018 29.848003 15.884727 29.474642 15.048611 28.727909 C 14.212496 27.981174 13.794444 26.901821 13.794444 25.489815 C 13.794444 24.07781 14.209096 22.998459 15.038414 22.251724 C 15.881327 21.491413 16.86018 21.111265 17.975 21.111265 Z"/></svg>';
const sdtIcon = '<svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" data-tooltip="SDT"><path id="Oval" fill="#00A1FE" fill-rule="evenodd" stroke="none" d="M 46 25 C 46 13.40202 36.59798 4 25 4 C 13.40202 4 4 13.40202 4 25 C 4 36.59798 13.40202 46 25 46 C 36.59798 46 46 36.59798 46 25 Z"/><g id="Group"><path id="Path" fill="#000000" fill-opacity="0.01" stroke="none" d="M 5 5 L 45 5 L 45 45 L 5 45 Z"/><path id="path1" fill="#ffffff" stroke="none" d="M 25 9.0625 C 16.19795 9.0625 9.0625 16.197948 9.0625 25 C 9.0625 33.801994 16.19795 40.9375 25 40.9375 C 33.801998 40.9375 40.9375 33.801994 40.9375 25 L 36.25 25 C 36.25 31.213245 31.213249 36.25 25 36.25 C 18.7868 36.25 13.75 31.213245 13.75 25 C 13.75 18.786802 18.7868 13.75 25 13.75 L 25 9.0625 Z"/><path id="path2" fill="#ffffff" stroke="none" d="M 33.75 12.5 C 33.75 13.880699 32.630753 15 31.25 15 C 29.869299 15 28.75 13.880699 28.75 12.5 C 28.75 11.119301 29.869299 10 31.25 10 C 32.630753 10 33.75 11.119301 33.75 12.5 Z"/><path id="path3" fill="#ffffff" stroke="none" d="M 40 18.75 C 40 20.130701 38.880753 21.25 37.5 21.25 C 36.119247 21.25 35 20.130701 35 18.75 C 35 17.369301 36.119247 16.25 37.5 16.25 C 38.880753 16.25 40 17.369301 40 18.75 Z"/><path id="path4" fill="#ffffff" fill-rule="evenodd" stroke="none" d="M 23.125 16.000004 L 26.880026 16.000004 L 26.880026 24.899998 L 33.125 28.647003 L 30.725 31.83075 L 23.125 27.066555 L 23.125 16.000004 Z"/></g></svg>';
// Animated throbber for when we're updating data...
const loadingSpinner = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>.spinner_VpEe{animation:spinner_vXu6 1.2s cubic-bezier(0.52,.6,.25,.99) infinite}.spinner_eahp{animation-delay:.4s}.spinner_f7Y2{animation-delay:.8s}@keyframes spinner_vXu6{0%{r:0;opacity:1}100%{r:11px;opacity:0}}</style><circle class="spinner_VpEe" cx="12" cy="12" r="0" fill="red"/><circle class="spinner_VpEe spinner_eahp" cx="12" cy="12" r="0" fill="red"/><circle class="spinner_VpEe spinner_f7Y2" cx="12" cy="12" r="0" fill="red"/></svg>';
// Icons for toggling visiiblity of the top toolbar...
const optionsToggleVisibleIcon = '<svg class="svg-inline--fa fa-square-caret-up" aria-hidden="true" focusable="false" data-prefix="far" data-icon="square-caret-up" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" data-fa-i2svg="" style="width: 25px; height: 25px;"><path fill="#000000" d="M241.6 175.7C237.1 170.8 230.7 168 224 168S210.9 170.8 206.4 175.7l-96 104c-6.469 7-8.188 17.19-4.375 25.91C109.8 314.3 118.5 320 127.1 320h192c9.531 0 18.16-5.656 22-14.38c3.813-8.719 2.094-18.91-4.375-25.91L241.6 175.7zM384 32H64C28.65 32 0 60.66 0 96v320c0 35.34 28.65 64 64 64h320c35.35 0 64-28.66 64-64V96C448 60.66 419.3 32 384 32zM400 416c0 8.82-7.178 16-16 16H64c-8.822 0-16-7.18-16-16V96c0-8.82 7.178-16 16-16h320c8.822 0 16 7.18 16 16V416z"></path></svg>';
const optionsToggleHiddenIcon = '<svg class="svg-inline--fa fa-square-caret-down" aria-hidden="true" focusable="false" data-prefix="far" data-icon="square-caret-down" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" data-fa-i2svg="" style="width: 25px; height: 25px;"><path fill="#000000" d="M320 192H128C118.5 192 109.8 197.7 105.1 206.4C102.2 215.1 103.9 225.3 110.4 232.3l96 104C210.9 341.2 217.3 344 224 344s13.09-2.812 17.62-7.719l96-104c6.469-7 8.188-17.19 4.375-25.91C338.2 197.7 329.5 192 320 192zM384 32H64C28.65 32 0 60.66 0 96v320c0 35.34 28.65 64 64 64h320c35.35 0 64-28.66 64-64V96C448 60.66 419.3 32 384 32zM400 416c0 8.82-7.178 16-16 16H64c-8.822 0-16-7.18-16-16V96c0-8.82 7.178-16 16-16h320c8.822 0 16 7.18 16 16V416z"></path></svg>';


// I'm making various different map color schemes available, created using Google's style editor (https://mapstyle.withgoogle.com/). Feel free to create your own and add it as a variable. We'll then set which style later in the 'initMap' function.

const standardStyle = [ { "stylers": [ { "lightness": 60 } ] }, { "elementType": "labels", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.land_parcel", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.neighborhood", "stylers": [ { "visibility": "off" } ] }, { "featureType": "poi", "elementType": "labels.text", "stylers": [ { "visibility": "off" } ] }, { "featureType": "poi.business", "stylers": [ { "visibility": "off" } ] }, { "featureType": "road", "elementType": "labels", "stylers": [ { "visibility": showRoadLabels } ] }, { "featureType": "road", "elementType": "labels.icon", "stylers": [ { "visibility": "off" } ] }, { "featureType": "transit", "stylers": [ { "visibility": "off" } ] } ];
// const standardStyle = [ { "stylers": [ { "lightness": 60 } ] } ];

const silverStyle = [ { "elementType": "geometry", "stylers": [ { "color": "#f5f5f5" } ] }, { "elementType": "labels.icon", "stylers": [ { "visibility": "off" } ] }, { "elementType": "labels.text.fill", "stylers": [ { "color": "#616161" }, { "lightness": 70 } ] }, { "elementType": "labels.text.stroke", "stylers": [ { "color": "#f5f5f5" } ] }, { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [ { "color": "#000000" }, { "lightness": 85 } ] }, { "featureType": "administrative.land_parcel", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [ { "color": "#bdbdbd" } ] }, { "featureType": "administrative.neighborhood", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [ { "color": "#000000" }, { "lightness": 80 } ] }, { "featureType": "poi", "elementType": "geometry", "stylers": [ { "color": "#eeeeee" } ] }, { "featureType": "poi", "elementType": "labels.text", "stylers": [ { "visibility": "off" } ] }, { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [ { "color": "#757575" } ] }, { "featureType": "poi.park", "elementType": "geometry", "stylers": [ { "color": "#e5e5e5" } ] }, { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [ { "color": "#9e9e9e" } ] }, { "featureType": "road", "stylers": [ { "lightness": 45 } ] }, { "featureType": "road", "elementType": "geometry", "stylers": [ { "color": "#ffffff" }, { "lightness": 55 } ] }, { "featureType": "road", "elementType": "geometry.fill", "stylers": [ { "lightness": 55 } ] }, { "featureType": "road", "elementType": "geometry.stroke", "stylers": [ { "lightness": 55 } ] }, { "featureType": "road", "elementType": "labels", "stylers": [ { "lightness": -15 }, { "visibility": showRoadLabels } ] }, { "featureType": "road", "elementType": "labels.icon", "stylers": [ { "visibility": "off" } ] }, { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [ { "color": "#ffffff" } ] }, { "featureType": "road.highway", "elementType": "geometry", "stylers": [ { "color": "#dadada" }, { "lightness": 50 }, { "weight": 0.5 } ] }, { "featureType": "transit.line", "elementType": "geometry", "stylers": [ { "color": "#e5e5e5" } ] }, { "featureType": "transit.station", "elementType": "geometry", "stylers": [ { "color": "#eeeeee" } ] }, { "featureType": "water", "elementType": "geometry", "stylers": [ { "color": "#c9c9c9" }, { "lightness": 20 } ] }, { "featureType": "water", "elementType": "geometry.fill", "stylers": [ { "lightness": 35 } ] }, { "featureType": "water", "elementType": "labels.text", "stylers": [ { "visibility": "off" } ] }, { "featureType": "water", "elementType": "labels.text.fill", "stylers": [ { "color": "#9e9e9e" } ] } ];

const silverBlueStyle = [ { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] }, { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] }, { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }, { "lightness": 70 }] }, { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] }, { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [{ "visibility": "off" }] }, { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 85 }] }, { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] }, { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] }, { "featureType": "administrative.neighborhood", "stylers": [{ "visibility": "off" }] }, { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 80 }] }, { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] }, { "featureType": "poi", "elementType": "labels.text", "stylers": [{ "visibility": "off" }] }, { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] }, { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] }, { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }, { "featureType": "road", "stylers": [{ "lightness": 45 }] }, { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }, { "lightness": 55 }] }, { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "lightness": 55 }] }, { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "lightness": 55 }] }, { "featureType": "road", "elementType": "labels", "stylers": [{ "visibility": showRoadLabels, "lightness": -15 }] }, { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }, { "lightness": 50 }, { "weight": 0.5 }] }, { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] }, { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] }, { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }, { "lightness": 20 }] }, { "featureType": "water", "elementType": "geometry.fill", "stylers": [{ "color": "#cad0d8" }, { "lightness": 35 }] }, { "featureType": "water", "elementType": "labels.text", "stylers": [{ "visibility": "off" }] }, { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] } ];

const darkStyle = [ { "elementType": "geometry", "stylers": [ { "color": "#212121" } ] }, { "elementType": "geometry.fill", "stylers": [ { "lightness": 10 } ] }, { "elementType": "labels", "stylers": [ { "visibility": "off" } ] }, { "elementType": "labels.icon", "stylers": [ { "visibility": "off" } ] }, { "elementType": "labels.text.fill", "stylers": [ { "color": "#757575" } ] }, { "elementType": "labels.text.stroke", "stylers": [ { "color": "#212121" } ] }, { "featureType": "administrative", "elementType": "geometry", "stylers": [ { "color": "#757575" } ] }, { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [ { "color": "#9e9e9e" } ] }, { "featureType": "administrative.land_parcel", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [ { "color": "#bdbdbd" } ] }, { "featureType": "administrative.neighborhood", "stylers": [ { "visibility": "off" } ] }, { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [ { "color": "#757575" } ] }, { "featureType": "poi.park", "elementType": "geometry", "stylers": [ { "color": "#181818" } ] }, { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [ { "color": "#616161" } ] }, { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [ { "color": "#1b1b1b" } ] }, { "featureType": "road", "elementType": "geometry.fill", "stylers": [ { "color": "#2c2c2c" } ] }, { "featureType": "road", "elementType": "labels", "stylers": [ { "visibility": showRoadLabels } ] }, { "featureType": "road", "elementType": "labels.icon", "stylers": [ { "visibility": "off" } ] }, { "featureType": "road", "elementType": "labels.text.fill", "stylers": [ { "color": "#8a8a8a" } ] }, { "featureType": "road.arterial", "elementType": "geometry", "stylers": [ { "color": "#373737" } ] }, { "featureType": "road.highway", "elementType": "geometry", "stylers": [ { "color": "#3c3c3c" } ] }, { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [ { "color": "#4e4e4e" } ] }, { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [ { "color": "#616161" } ] }, { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [ { "color": "#757575" } ] }, { "featureType": "water", "elementType": "geometry", "stylers": [ { "color": "#000000" } ] }, { "featureType": "water", "elementType": "labels.text.fill", "stylers": [ { "color": "#3d3d3d" } ] } ];

const aubergineStyle = [ { "elementType": "geometry", "stylers": [ { "color": "#1d2c4d" } ] }, { "elementType": "labels", "stylers": [ { "visibility": showRoadLabels } ] }, { "elementType": "labels.text.fill", "stylers": [ { "color": "#8ec3b9" } ] }, { "elementType": "labels.text.stroke", "stylers": [ { "color": "#1a3646" } ] }, { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [ { "color": "#4b6878" } ] }, { "featureType": "administrative.land_parcel", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [ { "color": "#64779e" } ] }, { "featureType": "administrative.neighborhood", "stylers": [ { "visibility": "off" } ] }, { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [ { "color": "#4b6878" } ] }, { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [ { "color": "#334e87" } ] }, { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [ { "color": "#023e58" } ] }, { "featureType": "poi", "stylers": [ { "visibility": "off" } ] }, { "featureType": "poi", "elementType": "geometry", "stylers": [ { "color": "#283d6a" } ] }, { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [ { "color": "#6f9ba5" } ] }, { "featureType": "poi", "elementType": "labels.text.stroke", "stylers": [ { "color": "#1d2c4d" } ] }, { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [ { "color": "#023e58" } ] }, { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [ { "color": "#3C7680" } ] }, { "featureType": "road", "elementType": "geometry", "stylers": [ { "color": "#304a7d" } ] }, { "featureType": "road", "elementType": "labels.icon", "stylers": [ { "visibility": "off" } ] }, { "featureType": "road", "elementType": "labels.text.fill", "stylers": [ { "color": "#98a5be" }, { "lightness": -30 } ] }, { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [ { "color": "#1d2c4d" } ] }, { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [ { "color": "#98a5be" } ] }, { "featureType": "transit", "elementType": "labels.text.stroke", "stylers": [ { "color": "#1d2c4d" } ] }, { "featureType": "transit.line", "elementType": "geometry.fill", "stylers": [ { "color": "#283d6a" } ] }, { "featureType": "transit.station", "elementType": "geometry", "stylers": [ { "color": "#3a4762" } ] }, { "featureType": "water", "elementType": "geometry", "stylers": [ { "color": "#0e1626" } ] }, { "featureType": "water", "elementType": "labels.text.fill", "stylers": [ { "color": "#4e6d70" } ] } ];

// RainViewer map options (feel free to change these to suit your taste)...
const rvOptionKind = 'radar'; // can be 'radar' or 'satellite'
const rvOptionColorScheme = 4; // from 0 to 8. Check the https://rainviewer.com/api/color-schemes.html for additional inforvation
const rvOptionSmoothData = 1; // 0 - not smooth, 1 - smooth
const rvOptionSnowColors = 1; // 0 - do not show snow colors, 1 - show snow colors
// Variables for holding RainViewer API data...
let rvAPIData = {};
let rvMapFrames = [];
let rvLastPastFramePosition = -1;
let weatherRefresher = null;

// Number formatter for use in wildfire data...
const numFormatOptions = {
	style: 'decimal',  // Other options: 'currency', 'percent', etc.
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
}

// Adding a top-level placeholder for our Google Map objects...
let map = "";
let clusterer = "";
let bounds = "";

// Fetch helper with timeout & AbortController...
if (!window.fetchJson) {
	window.fetchJson = async function(url, { timeoutMs = 8000 } = {}) {
		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort("timeout"), timeoutMs);
		try {
			const res = await fetch(url, { signal: ac.signal, credentials: "omit", cache: "no-store" });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const ct = res.headers.get("content-type") || "";
			if (ct.includes("application/json")) return await res.json();
			return await res.text();
		} finally { clearTimeout(timer); }
	};
}

// Batch builder to avoid jank when (re)building many markers...
if (!window.buildMarkersInBatches) {
	window.buildMarkersInBatches = async function(items, fn, batchSize = 250) {
		for (let i = 0; i < items.length; i += batchSize) {
			const slice = items.slice(i, i + batchSize);
			for (const it of slice) { try { fn(it); } catch(e) {} }
			await new Promise(r => { if ('requestIdleCallback' in window) requestIdleCallback(()=>r()); else setTimeout(r,0); });
		}
	};
}

// Variable for holding our map markers...
let markers = [];
// For tracking if we've already established an initial center for our map based on markers...
let centerCalculated = false;
// For storing polyline references and their marker associations...
let polylines = [];

// Clear all connecting polylines and their listeners
function clearAllPolylines() {
	if (polylines.length === 0) return;
	// console.debug("Clearing " + polylines.length + " polylines");
	polylines.forEach(p => {
		if (p && p.polyline) {
			google.maps.event.clearInstanceListeners(p.polyline);
			p.polyline.setMap(null);
		}
	});
	polylines = [];
}

// Update polyline endpoints to follow clusters/markers
function updatePolylineEndpoints() {
	if (!polylines.length) return;
	// console.debug("Updating " + polylines.length + " polyline endpoints");
	polylines.forEach(p => {
		if (!p || !p.polyline) return;
		const sourcePos = getMarkerOrClusterPosition(p.sourceDeviceID);
		const targetPos = getMarkerOrClusterPosition(p.targetDeviceID);
		if (sourcePos && targetPos) {
			p.polyline.setPath([sourcePos, targetPos]);
		}
	});
}

// Resolve a device's current visible position (cluster center or marker)
function getMarkerOrClusterPosition(deviceID) {
	if (!deviceID) return null;
	const marker = markers.find(m => m.deviceID == deviceID);
	if (!marker) return null;

	// Check if clustering is enabled and marker is in a cluster
	if (clusterer) {
		// Get clusters - the MarkerClusterer library stores them in .clusters after rendering
		const clusters = clusterer.clusters || [];
		for (const cluster of clusters) {
			// Each cluster has a .markers array and a .marker (the rendered cluster marker)
			if (cluster.markers && cluster.markers.includes(marker)) {
				// Marker is in this cluster - get the cluster's rendered position
				if (cluster.marker && cluster.marker.position) {
					// The cluster's AdvancedMarkerElement position
					const pos = cluster.marker.position;
					if (pos instanceof google.maps.LatLng) return pos;
					if (typeof pos.lat === 'number' && typeof pos.lng === 'number') {
						return new google.maps.LatLng(pos.lat, pos.lng);
					}
				}
				// Fallback: calculate center from clustered markers
				const pts = cluster.markers.map(m => {
					if (!m.position) return null;
					const p = m.position;
					if (p instanceof google.maps.LatLng) return p;
					if (typeof p.lat === 'number' && typeof p.lng === 'number') {
						return new google.maps.LatLng(p.lat, p.lng);
					}
					return null;
				}).filter(Boolean);
				if (pts.length) {
					const avgLat = pts.reduce((s, p) => s + p.lat(), 0) / pts.length;
					const avgLng = pts.reduce((s, p) => s + p.lng(), 0) / pts.length;
					return new google.maps.LatLng(avgLat, avgLng);
				}
			}
		}
	}

	// Marker is not clustered - return its position
	if (marker.position) {
		const pos = marker.position;
		if (pos instanceof google.maps.LatLng) return pos;
		if (typeof pos.lat === 'number' && typeof pos.lng === 'number') {
			return new google.maps.LatLng(pos.lat, pos.lng);
		}
	}
	return null;
}

// For caching marker latitude/longitude information between refreshes...
const __LMBMW_CACHE_KEY = "lm_bmw.cachedAddresses.v1";
function loadCache() {
	try {
		const obj = JSON.parse(localStorage.getItem(__LMBMW_CACHE_KEY));
		return (obj && typeof obj === "object") ? obj : {};
	} catch (e) { return {}; }
}
function saveCache() {
	try { localStorage.setItem(__LMBMW_CACHE_KEY, JSON.stringify(cachedAddresses)); } catch (e) {}
}
function clearCache() {
	try {
		localStorage.removeItem(__LMBMW_CACHE_KEY);
		// Display our progress to the user (if status area is available)...
		if (!_dom.refreshStatusArea) {
			_dom.refreshStatusArea = document.getElementById("refreshStatusArea");
		}
		if (_dom.refreshStatusArea) {
			_dom.refreshStatusArea.innerHTML = "Cache has been reset";
			_dom.refreshStatusArea.style.display = "flex";
			// Add timer to remove message after 2 seconds...
			setTimeout(() => {
				_dom.refreshStatusArea.innerHTML = "";
				_dom.refreshStatusArea.style.display = "none";
			}, 2000);
		}
	} catch (e) {}
}
let cachedAddresses = loadCache();

// For holding our LM group data...
let groupData = [];
// For timing our refreshes...
let refreshStartTime = new Date();
// For tracking when to do a full refresh...
let pollCount = 0;
let fullRefresh = true;

// For holding our connection status data...
let lineData = [];

// Pre-populate the group path filter field...
_dom.customGroupFilterField.value = groupPathFilter;

// Set toolbar icons...
_dom.showClearedLabel.innerHTML = clearedIcon;
_dom.showWarningsLabel.innerHTML = warningIcon;
_dom.showErrorsLabel.innerHTML = errorIcon;
_dom.showCriticalsLabel.innerHTML = criticalIcon;
_dom.showSDTLabel.innerHTML = sdtIcon;

// Placeholder for marker cluster info...
let clusterInfoWindow = null;

// We've prepped everything, so now calling the function to populate the map...
initMap();


// ----- FUNCTIONS

// Function to create our map...
async function initMap() {
	// Load some libraries needed by Google Maps...
	const { Map, RenderingType, InfoWindow } = await google.maps.importLibrary("maps");
	const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
	const {ColorScheme} = await google.maps.importLibrary("core");

	// Create our Google Map...
	map = new google.maps.Map(document.getElementById("googleMap"), {
		zoom: 3,
		center: { lat: 0, lng: 0 },
		mapId: "DEMO_MAP_ID",
		// colorScheme: ColorScheme.DARK,
		colorScheme: ColorScheme.LIGHT,
		zoomControl: true,
		cameraControl: false,
		mapTypeControl: false,
		// scaleControl: boolean,
		streetViewControl: false,
		rotateControl: false,
		fullscreenControl: true,
		tilt: mapTilt,
		heading: mapHeading,
		gestureHandling: mapGestureHandling,
		renderingType: RenderingType.VECTOR,
		isFractionalZoomEnabled: true,
		minZoom: 2,
	});

	// Redraw polylines after zoom/pan/drag completes...
	map.addListener("idle", () => updatePolylineEndpoints());

	// Vector maps are nicer but sometimes don't load right away. Plus they're mainly useful if tilt controls are enabled, so use the normal raster map by default...
	// if (showMapTiltControls) {
	// 	map.setRenderingType(RenderingType.VECTOR);
	// };

	// Add some custom controls to the map...
	const weatherControlDiv = document.createElement("div");
	// Create a button to the map for toggling visibility of the options bar...
	const weatherControls = createWeatherToggleControl(map);
	weatherControlDiv.appendChild(weatherControls);

	// Create a div to hold our refresh & zoom reset buttons...
	const weatherControlButtonDiv = document.createElement("div");
	weatherControlButtonDiv.style.display = "flex";
	weatherControlButtonDiv.style.flexDirection = "column";
	weatherControlButtonDiv.style.backgroundColor = "rgb(255 255 255)";
	weatherControlButtonDiv.style.border = "0";
	weatherControlButtonDiv.style.borderRadius = "3px";
	weatherControlButtonDiv.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
	weatherControlButtonDiv.style.width = "40px";
	weatherControlButtonDiv.style.height = "81px";
	weatherControlButtonDiv.style.margin = "0 10px";
	// Create a button to force-refresh the map data...
	const weatherRefreshControl = createWeatherRefreshControl(map);
	weatherControlButtonDiv.appendChild(weatherRefreshControl);
	const weatherControlDivider = document.createElement("div");
	// Create a divider between the two buttons...
	weatherControlDivider.innerHTML = '<div style="position: relative; overflow: hidden; width: 30px; height: 1px; margin: 0px 5px; background-color: rgb(230, 230, 230); top: 0px;"></div>';
	weatherControlButtonDiv.appendChild(weatherControlDivider);
	// Create a button to reset the zoom on the map...
	const mapZoomResetControl = createZoomResetControl(map);
	weatherControlButtonDiv.appendChild(mapZoomResetControl);
	// Add our button div to our custom map controls...
	weatherControlDiv.appendChild(weatherControlButtonDiv);
	// Attach our controls to the map...
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(weatherControlDiv);

	// Optionally create a div to hold our map tilt & heading buttons...
	if (showMapTiltControls) {
		const mapControlButtonDiv = document.createElement("div");
		mapControlButtonDiv.style.display = "flex";
		mapControlButtonDiv.style.flexDirection = "column";
		mapControlButtonDiv.style.backgroundColor = "rgb(255 255 255)";
		mapControlButtonDiv.style.border = "0";
		mapControlButtonDiv.style.borderRadius = "20px";
		mapControlButtonDiv.style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";
		mapControlButtonDiv.style.width = "40px";
		mapControlButtonDiv.style.margin = "0 10px";
		mapControlButtonDiv.style.alignItems = "center";
		mapControlButtonDiv.style.padding = "5px 0";
		// Create a button to tilt the map forward...
		const mapRotateForwardControl = createRotateForwardControl(map);
		mapControlButtonDiv.appendChild(mapRotateForwardControl);
		// Create a button to tilt the map backward...
		const mapRotateBackControl = createRotateBackControl(map);
		mapControlButtonDiv.appendChild(mapRotateBackControl);
		// Create a button to rotate the map right...
		const mapRotateRightControl = createRotateRightControl(map);
		mapControlButtonDiv.appendChild(mapRotateRightControl);
		// Create a button to rotate the map left...
		const mapRotateLeftControl = createRotateLeftControl(map);
		mapControlButtonDiv.appendChild(mapRotateLeftControl);
		// Attach our controls to the map...
		map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(mapControlButtonDiv);
	};

	// Add an area to display when we're updating...
	const updateAreaDiv = await createUpdateArea(map);

	// *** MAP THEME ***
	// Set our map theme (can be set via default at beginning of this script or via a "MapStyle" dashboard token)...
	let styledMapType = new google.maps.StyledMapType(silverStyle);
	if (mapStyle == "standard") {
		styledMapType = new google.maps.StyledMapType(standardStyle);
	} else if (mapStyle == "dark") {
		styledMapType = new google.maps.StyledMapType(darkStyle);
	} else if (mapStyle == "aubergine") {
		styledMapType = new google.maps.StyledMapType(aubergineStyle);
	} else if (mapStyle == "silverblue") {
		styledMapType = new google.maps.StyledMapType(silverBlueStyle);
	};

	map.mapTypes.set("customMapStyle", styledMapType);
	map.setMapTypeId("customMapStyle");

	// Toggle visibility of our weather options...
	enableWeather();

	// Toggle hiding the options bar if set as the default...
	if (hideMapOptionsByDefault) {
		document.getElementById("optionsBar").classList.remove("optionsVisible");
		document.getElementById("optionsBar").classList.add("optionsHidden");
	};

	// Load our LogicMonitor data only after we know our update area has been created...
	waitForElm('#refreshStatusArea').then((elm) => {
		// console.log('Element is ready');
		refreshGroupData();
	});

	// Refresh the map data at regular intervals (using the 'statusUpdateIntervalMinutes' variable set near the top of this script)...
	if (!developmentFlag) {
		mapDataRefresher = setInterval(function() {
			refreshGroupData(timedRefresh = true);
			console.log("Map data refreshed.");
		}, statusUpdateIntervalMinutes*1000*60);
	};
};

// Function for creating & styling the map button for toggling the options bar...
function createWeatherToggleControl(map) {
	const weatherToggle = document.createElement("button");

	weatherToggle.id = "weatherControlToggle";
	weatherToggle.style.backgroundColor = "rgb(255 255 255)";
	weatherToggle.style.border = "0";
	weatherToggle.style.borderRadius = "3px";
	weatherToggle.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
	// weatherToggle.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
	weatherToggle.style.cursor = "pointer";
	weatherToggle.style.fontSize = "x-large";
	weatherToggle.style.textAlign = "center";
	weatherToggle.style.margin = "10px";
	weatherToggle.style.height = "40px";
	weatherToggle.style.width = "40px";
	weatherToggle.style.verticalAlign = "middle";
	// weatherToggle.innerHTML = 'Toggle Controls';
	weatherToggle.title = "Toggle visibility of the map controls";
	if (hideMapOptionsByDefault) {
		weatherToggle.innerHTML = optionsToggleHiddenIcon;
	} else {
		weatherToggle.innerHTML = optionsToggleVisibleIcon;
	};
	weatherToggle.type = "button";

	weatherToggle.addEventListener("click", () => {
		const optionsBar = document.getElementById("optionsBar");
		if (optionsBar.classList.contains("optionsHidden")) {
			optionsBar.classList.remove("optionsHidden");
			optionsBar.classList.add("optionsVisible");
			weatherToggle.innerHTML = optionsToggleVisibleIcon;
		} else {
			optionsBar.classList.remove("optionsVisible");
			optionsBar.classList.add("optionsHidden");
			weatherToggle.innerHTML = optionsToggleHiddenIcon;
		};
	});

	return weatherToggle;
};

function createWeatherRefreshControl(map) {
	const weatherControls = document.createElement("button");

	weatherControls.id = "weatherRefreshButton";
	weatherControls.style.backgroundColor = "rgb(255 255 255 / 0%)";
	weatherControls.style.border = "0";
	weatherControls.style.borderRadius = "3px";
	// weatherControls.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
	// weatherControls.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
	weatherControls.style.cursor = "pointer";
	weatherControls.style.fontSize = "x-large";
	weatherControls.style.textAlign = "center";
	// weatherControls.style.margin = "10px";
	weatherControls.style.height = "40px";
	weatherControls.style.width = "40px";
	weatherControls.style.verticalAlign = "middle";
	// weatherControls.innerHTML = 'Toggle Controls';
	weatherControls.title = "Force refresh the map data";
	weatherControls.innerHTML = '<svg viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M7.1998 10.8799L3.9998 14.0799L0.799805 10.8799" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/> <path d="M17.72 6.77007C16.6086 5.63347 15.1839 4.85371 13.6275 4.53032C12.0711 4.20693 10.4536 4.35459 8.98145 4.95439C7.5093 5.5542 6.24924 6.57899 5.362 7.898C4.47476 9.21701 4.0006 10.7703 4 12.3599V14.0901" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/> <path d="M16.7998 13.96L19.9998 10.75L23.1998 13.96" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/> <path d="M6.28027 18.0801C7.39163 19.2167 8.8164 19.9962 10.3728 20.3196C11.9292 20.643 13.5467 20.4956 15.0188 19.8958C16.491 19.2959 17.751 18.2712 18.6383 16.9521C19.5255 15.6331 19.9997 14.0796 20.0003 12.49V10.76" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	weatherControls.type = "button";

	weatherControls.addEventListener("click", refreshGroupData);

	return weatherControls;
};

function createZoomResetControl(map) {
	const weatherControls = document.createElement("button");

	weatherControls.id = "weatherZoomResetButton";
	weatherControls.style.backgroundColor = "rgb(255 255 255 / 0%)";
	weatherControls.style.border = "0";
	weatherControls.style.borderRadius = "3px";
	weatherControls.style.cursor = "pointer";
	weatherControls.style.fontSize = "x-large";
	weatherControls.style.textAlign = "center";
	// weatherControls.style.margin = "10px";
	weatherControls.style.height = "40px";
	weatherControls.style.width = "40px";
	weatherControls.style.verticalAlign = "middle";
	// weatherControls.innerHTML = 'Toggle Controls';
	weatherControls.title = "Reset map zoom";
	weatherControls.innerHTML = '<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" width="25px" height="25px" viewBox="0 0 400 400.00001" id="svg2" version="1.1" inkscape:version="0.91 r13725" sodipodi:docname="minimize.svg"> <defs id="defs4" /> <g transform="translate(0,-652.36216)"> <path style="opacity:1;fill:#000000;fill-opacity:1;stroke:none;stroke-width:1;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" d="M 17.6035,652.36212 0,670.05352 l 108.5469,109.0918 -84.0235,0 0,25.0195 126.5235,0 0,-127.1563 -24.8965,0 0,84.4434 -108.5469,-109.0898 z m 364.793,0 -108.5469,109.0898 0,-84.4434 -24.8965,0 0,127.1563 126.5235,0 0,-25.0195 -84.0235,0 L 400,670.05352 382.3965,652.36212 Z M 24.5234,900.5593 l 0,25.0196 84.0235,0 L 0,1034.6708 l 17.6035,17.6914 108.5469,-109.09 0,84.4435 24.8965,0 0,-127.1564 -126.5235,0 z m 224.4297,0 0,127.1564 24.8965,0 0,-84.4435 108.5469,109.09 L 400,1034.6708 291.4531,925.5789 l 84.0235,0 0,-25.0196 -126.5235,0 z" id="minimize"> <title id="title23704">Reset map zoom</title></path></g></svg>';
	weatherControls.type = "button";

	weatherControls.addEventListener("click", resetZoom);

	return weatherControls;
};

function createRotateRightControl(map) {
	const weatherControls = document.createElement("button");

	weatherControls.id = "mapRotateRightButton";
	weatherControls.style.backgroundColor = "rgb(255 255 255 / 0%)";
	weatherControls.style.border = "0";
	weatherControls.style.borderRadius = "3px";
	weatherControls.style.cursor = "pointer";
	weatherControls.style.fontSize = "x-large";
	weatherControls.style.textAlign = "center";
	// weatherControls.style.margin = "10px";
	weatherControls.style.height = "30px";
	weatherControls.style.width = "30px";
	weatherControls.style.verticalAlign = "middle";
	// weatherControls.innerHTML = 'Toggle Controls';
	weatherControls.title = "Rotate Map Right";
	weatherControls.innerHTML = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"> <path id="Path" fill="#000000" stroke="none" d="M 30.322001 21.322001 C 30.228001 21.277 30.118999 21.250999 30.003 21.250999 C 29.705 21.250999 29.448 21.423 29.323999 21.673 L 29.322001 21.677 C 27.145 26.191999 22.604 29.250999 17.348 29.250999 C 10.03 29.250999 4.097 23.318001 4.097 16 C 4.097 8.681999 10.029 2.75 17.347 2.749001 L 17.347 2.749001 C 17.358999 2.749001 17.374001 2.749001 17.389 2.749001 C 21.684999 2.749001 25.499001 4.813 27.893 8.003 L 27.917 8.036999 L 22.274 8.036999 C 21.860001 8.036999 21.524 8.373001 21.524 8.786999 C 21.524 9.201 21.860001 9.536999 22.274 9.536999 L 22.274 9.536999 L 29.346001 9.536999 C 29.365 9.536999 29.381001 9.527 29.4 9.526001 C 29.507 9.512001 29.603001 9.483 29.693001 9.442001 L 29.687 9.445 C 29.702 9.437 29.718 9.437 29.733 9.429001 C 29.754999 9.410999 29.775 9.393 29.792999 9.374001 L 29.792999 9.374001 C 29.837 9.341 29.875999 9.306 29.910999 9.265999 L 29.912001 9.264999 C 29.938999 9.232 29.965 9.195 29.986 9.156 L 29.988001 9.152 C 30.038 9.071999 30.07 8.977001 30.079 8.875 L 30.079 8.873001 C 30.086 8.848999 30.091999 8.82 30.096001 8.790001 L 30.096001 8.785999 L 30.096001 1.715 C 30.096001 1.301001 29.76 0.965 29.346001 0.965 C 28.931999 0.965 28.596001 1.301001 28.596001 1.715 L 28.596001 1.715 L 28.596001 6.485001 C 25.898001 3.275 21.881001 1.247999 17.391001 1.247999 C 17.375 1.247999 17.358999 1.247999 17.344 1.247999 L 17.346001 1.247999 C 9.201 1.25 2.6 7.853001 2.6 15.998001 C 2.6 24.143999 9.204 30.747999 17.35 30.747999 C 23.198999 30.747999 28.253 27.344 30.638 22.408001 L 30.676001 22.32 C 30.722 22.226 30.747999 22.115 30.747999 21.997999 C 30.747999 21.701 30.575001 21.444 30.325001 21.322001 L 30.320999 21.32 Z"/> </svg>';
	// weatherControls.innerHTML = '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"> <g id="Group-copy"> <path id="Path" fill="#000000" stroke="#000000" stroke-width="2" d="M 31.638996 17.068626 C 31.183994 17.524628 31.183994 18.265625 31.638996 18.719627 L 35.817997 22.898624 C 26.449997 22.942627 17.635994 24.545628 10.962997 27.445625 C 3.893997 30.519627 -7e-06 34.722626 -7e-06 39.284626 C -7e-06 48.483627 15.904995 55.684624 36.204998 55.684624 C 56.506996 55.684624 72.410004 48.480625 72.410004 39.284626 C 72.410004 38.640625 71.886002 38.117626 71.241997 38.117626 C 70.598999 38.117626 70.073997 38.640625 70.073997 39.284626 C 70.073997 46.909626 54.562996 53.348625 36.204998 53.348625 C 17.847996 53.348625 2.335999 46.907623 2.335999 39.284626 C 2.335999 35.758625 5.821 32.228626 11.895996 29.586624 C 18.275993 26.810627 26.749996 25.273624 35.798996 25.233627 L 31.638996 29.389626 C 31.183994 29.843624 31.183994 30.584625 31.638996 31.040627 C 32.094997 31.494625 32.834995 31.494625 33.289997 31.040627 L 40.278996 24.056625 L 33.289997 17.067627 C 32.834995 16.610626 32.094997 16.610626 31.638996 17.068626 Z"/> </g> </svg>';
	weatherControls.type = "button";

	weatherControls.addEventListener("click", function() {adjustMap("rotate", -5);});

	return weatherControls;
};

function createRotateLeftControl(map) {
	const weatherControls = document.createElement("button");

	weatherControls.id = "mapRotateLeftButton";
	weatherControls.style.backgroundColor = "rgb(255 255 255 / 0%)";
	weatherControls.style.border = "0";
	weatherControls.style.borderRadius = "3px";
	weatherControls.style.cursor = "pointer";
	weatherControls.style.fontSize = "x-large";
	weatherControls.style.textAlign = "center";
	// weatherControls.style.margin = "10px";
	weatherControls.style.height = "30px";
	weatherControls.style.width = "30px";
	weatherControls.style.verticalAlign = "middle";
	// weatherControls.innerHTML = 'Toggle Controls';
	weatherControls.title = "Rotate Map Left";
	weatherControls.innerHTML = '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"> <path id="Path" fill="#000000" stroke="none" d="M 16 1.25 C 15.987 1.25 15.971 1.25 15.956 1.25 C 11.466 1.25 7.448 3.276001 4.769 6.464001 L 4.751 6.486 L 4.751 1.716999 C 4.751 1.302999 4.415 0.966999 4.001 0.966999 C 3.587 0.966999 3.251 1.302999 3.251 1.716999 L 3.251 1.716999 L 3.251 8.788 C 3.255 8.818001 3.261 8.845001 3.268 8.869999 L 3.267 8.865 C 3.275 8.970001 3.307 9.067001 3.358 9.15 L 3.356 9.146999 C 3.381 9.193001 3.408 9.232 3.438 9.269001 L 3.437 9.268 C 3.471 9.306 3.508 9.34 3.548 9.369999 L 3.55 9.371 C 3.57 9.390999 3.59 9.41 3.612 9.428001 L 3.613 9.429001 C 3.628 9.438 3.645 9.438 3.661 9.445999 C 3.703 9.466999 3.751 9.485001 3.802 9.497 L 3.807 9.498001 C 3.847 9.511 3.894 9.521 3.942 9.526001 L 3.945 9.526001 C 3.964 9.527 3.981 9.536999 4.001 9.536999 L 11.072 9.536999 C 11.486 9.536999 11.822 9.201 11.822 8.786999 C 11.822 8.373001 11.486 8.036999 11.072 8.036999 L 11.072 8.036999 L 5.429 8.036999 C 7.848 4.813 11.662 2.749001 15.958 2.749001 C 15.973 2.749001 15.988 2.749001 16.003 2.749001 L 16.000999 2.749001 C 23.318001 2.750999 29.247999 8.681999 29.247999 15.999001 C 29.247999 23.316 23.316 29.249001 15.998 29.249001 C 10.743 29.249001 6.203 26.190001 4.061 21.756001 L 4.027 21.677 C 3.903 21.423 3.647 21.250999 3.35 21.250999 C 2.936 21.250999 2.6 21.587 2.6 22.000999 C 2.6 22.117001 2.626 22.226999 2.674 22.325001 L 2.672 22.32 C 5.095 27.344999 10.15 30.750999 16.000999 30.750999 C 24.148001 30.750999 30.752001 24.146999 30.752001 16 C 30.752001 7.853001 24.148001 1.249001 16.002001 1.249001 L 16.002001 1.249001 Z"/> </svg>';
	weatherControls.type = "button";

	weatherControls.addEventListener("click", function() {adjustMap("rotate", 5);});

	return weatherControls;
};

function createRotateForwardControl(map) {
	const weatherControls = document.createElement("button");

	weatherControls.id = "mapRotateForwardButton";
	weatherControls.style.backgroundColor = "rgb(255 255 255 / 0%)";
	weatherControls.style.border = "0";
	weatherControls.style.borderRadius = "3px";
	weatherControls.style.cursor = "pointer";
	weatherControls.style.fontSize = "x-large";
	weatherControls.style.textAlign = "center";
	// weatherControls.style.margin = "10px";
	weatherControls.style.height = "30px";
	weatherControls.style.width = "30px";
	weatherControls.style.verticalAlign = "middle";
	// weatherControls.innerHTML = 'Toggle Controls';
	weatherControls.title = "Rotate Map Up";
	weatherControls.innerHTML = '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"> <g id="Group"> <path id="Path" fill="#000000" stroke="#000000" stroke-width="2" d="M 55.341 31.229 C 54.884998 30.773998 54.144001 30.773998 53.689999 31.229 L 49.511002 35.408001 C 49.466999 26.040001 47.863998 17.225998 44.964001 10.553001 C 41.889999 3.484001 37.687 -0.410004 33.125 -0.410004 C 23.926001 -0.410004 16.725 15.494999 16.725 35.795002 C 16.725 56.097 23.929001 72 33.125 72 C 33.769001 72 34.292 71.475998 34.292 70.831993 C 34.292 70.188995 33.769001 69.663994 33.125 69.663994 C 25.5 69.663994 19.061001 54.153 19.061001 35.795002 C 19.061001 17.438 25.502001 1.926003 33.125 1.926003 C 36.651001 1.926003 40.181 5.411003 42.823002 11.486 C 45.598999 17.865997 47.136002 26.34 47.175999 35.389 L 43.02 31.229 C 42.566002 30.773998 41.825001 30.773998 41.368999 31.229 C 40.915001 31.685001 40.915001 32.424999 41.368999 32.880001 L 48.353001 39.868999 L 55.341999 32.880001 C 55.799 32.424999 55.799 31.685001 55.341 31.229 Z"/> </g> </svg>';
	weatherControls.type = "button";

	weatherControls.addEventListener("click", function() {adjustMap("tilt", 5);});

	return weatherControls;
};

function createRotateBackControl(map) {
	const weatherControls = document.createElement("button");

	weatherControls.id = "mapRotateBackButton";
	weatherControls.style.backgroundColor = "rgb(255 255 255 / 0%)";
	weatherControls.style.border = "0";
	weatherControls.style.borderRadius = "3px";
	weatherControls.style.cursor = "pointer";
	weatherControls.style.fontSize = "x-large";
	weatherControls.style.textAlign = "center";
	// weatherControls.style.margin = "10px";
	weatherControls.style.height = "30px";
	weatherControls.style.width = "30px";
	weatherControls.style.verticalAlign = "middle";
	// weatherControls.innerHTML = 'Toggle Controls';
	weatherControls.title = "Rotate Map Down";
	weatherControls.innerHTML = '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"> <g id="Group-copy"> <path id="Path" fill="#000000" stroke="#000000" stroke-width="2" d="M 17.068624 40.361004 C 17.524626 40.816006 18.265623 40.816006 18.719625 40.361004 L 22.898623 36.182003 C 22.942625 45.550003 24.545628 54.364006 27.445625 61.037003 C 30.519627 68.106003 34.722626 72.000008 39.284626 72.000008 C 48.483627 72.000008 55.684624 56.095005 55.684624 35.795002 C 55.684624 15.493004 48.480625 -0.410004 39.284626 -0.410004 C 38.640625 -0.410004 38.117626 0.113998 38.117626 0.758003 C 38.117626 1.401001 38.640625 1.926003 39.284626 1.926003 C 46.909626 1.926003 53.348625 17.437004 53.348625 35.795002 C 53.348625 54.152004 46.907627 69.664001 39.284626 69.664001 C 35.758625 69.664001 32.228626 66.179001 29.586624 60.104004 C 26.810627 53.724007 25.273624 45.250004 25.233627 36.201004 L 29.389626 40.361004 C 29.843624 40.816006 30.584625 40.816006 31.040627 40.361004 C 31.494625 39.905003 31.494625 39.165005 31.040627 38.710003 L 24.056625 31.721004 L 17.067625 38.710003 C 16.610624 39.165005 16.610624 39.905003 17.068624 40.361004 Z"/> </g> </svg>';
	weatherControls.type = "button";

	weatherControls.addEventListener("click", function() {adjustMap("tilt", -5);});

	return weatherControls;
};

function createUpdateArea(map) {
	const updateAreaDiv = document.createElement("div");
	updateAreaDiv.id = "refreshStatusArea";
	updateAreaDiv.style.display = "flex";
	updateAreaDiv.style.alignItems = "center";
	updateAreaDiv.style.width = "fit-content";
	updateAreaDiv.style.padding = "0 10px";
	updateAreaDiv.style.margin = "10px 0 0 0";
	updateAreaDiv.style.height = "40px";
	updateAreaDiv.style.backgroundColor = "rgb(255 255 255)";
	// updateAreaDiv.style.backgroundColor = "rgba(0, 0, 0,0.7)";
	// updateAreaDiv.style.border = "1px solid lightcoral";
	updateAreaDiv.style.border = "0";
	updateAreaDiv.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
	updateAreaDiv.innerHTML = "Updating...";
	// Attach to the map...
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(updateAreaDiv);

	return updateAreaDiv;
}

function adjustMap(mode, amount) {
	switch (mode) {
		case "tilt":
			map.setTilt(map.getTilt() + amount);
			mapTilt = map.getTilt();
			break;
		case "rotate":
			map.setHeading(map.getHeading() + amount);
			mapHeading = map.getHeading();
			break;
		default:
			break;
	};
};

// Function to load our LogicMonitor data and add pins to the map...
async function refreshGroupData(timedRefresh = false) {
	// Cancel any in-progress refresh operation
	if (_currentRefreshController) {
		_currentRefreshController.abort();
		console.debug('Previous refresh operation cancelled.');
	}
	_currentRefreshController = new AbortController();
	const refreshSignal = _currentRefreshController.signal;

	// Capture current time for tracking how long the total refresh takes...
	refreshStartTime = performance.now();

	// Get the current value of the group path filter field...
	const groupPathFilterFieldValue = _dom.customGroupFilterField.value;
	if (groupPathFilterFieldValue != "" && groupPathFilterFieldValue != groupPathFilter) {
		groupPathFilter = groupPathFilterFieldValue;

		// The filter changed so clear any previous markers from the map...
		for (let i = 0; i < markers.length; i++) {
			markers[i].setMap(null);
			if (typeof clusterer == "object") {
				clusterer.setMap(null);
			}
		}
		markers = [];
	} else if (groupPathFilterFieldValue == "") {
		// The user cleared the field, so reset it back to the initial value...
		groupPathFilter = initialGroupPathFilter;
	}
	_dom.customGroupFilterField.value = groupPathFilter;

	// Get current state of the severity checkboxes on the toolbar...
	showCleared = _dom.showCleared.checked;
	showWarnings = _dom.showWarnings.checked;
	showErrors = _dom.showErrors.checked;
	showCriticals = _dom.showCriticals.checked;
	showSDT = _dom.showSDT.checked;
	// If the user unchecked all the severities it'd essentially query all severities, so re-check all the checkboxes if that happens...
	if (!showCleared && !showWarnings && !showErrors && !showCriticals && !showSDT) {
		_dom.showCleared.checked = true;
		_dom.showWarnings.checked = true;
		_dom.showErrors.checked = true;
		_dom.showCriticals.checked = true;
		_dom.showSDT.checked = true;
	}
	// Get current state of the auto-zoom checkbox on the toolbar...
	autoResetMapOnRefresh = _dom.autoZoom.checked;

	// If there was a wildcard in the group path then do a "like" search, otherwise search for an exact match...
	let pathOperator = ":";
	if (groupPathFilter.includes("*")) {
		pathOperator = "~";
	};

	// Temporarily disable the toolbar fields to prevent user from refreshing before previous refresh is complete...
	_dom.mapOptionsArea.classList.add("disabled");
	// Cache refresh button reference if not already cached
	if (!_dom.weatherRefreshButton) {
		_dom.weatherRefreshButton = document.getElementById("weatherRefreshButton");
	}
	if (_dom.weatherRefreshButton) {
		_dom.weatherRefreshButton.classList.add("disabled");
	}

	// Clear any previously fetched data...
	groupData = [];
	// For tracking how many groups to fetch & pagination...
	let totalGroups = 1000;
	let offset = 0;

	// Cache refresh status area reference if not already cached
	if (!_dom.refreshStatusArea) {
		_dom.refreshStatusArea = document.getElementById("refreshStatusArea");
	}
	// Display our progress to the user...
	_dom.refreshStatusArea.innerHTML = loadingSpinner + "&nbsp;Updating";
	_dom.refreshStatusArea.style.display = "flex";

	// Prepare to call the LogicMonitor API method...
	const httpVerb = "GET";

	// List of fields to fetch...
	let fieldList = "alertStatus,displayName,description,id,hostStatus,name,sdtStatus,numOfHosts,numOfAWSDevices,numOfAzureDevices,numOfGcpDevices,numOfKubernetesDevices,numOfDirectDevices,numOfSubGroups,customProperties,autoProperties";
	// Only fetch custom & inherited properties on full refreshes...
	if (cachedAddresses.length == 0 || pollCount > fullRefreshInterval) {
		fullRefresh = true;
		fieldList = fieldList + ",inheritedProperties,systemProperties";
		pollCount = 0;
	};

	// Determine whether to fetch groups or resources...
	let deviceFilter = "";
	let resourcePath = "/device/groups";
	if (mapSourceType != "groups") {
		resourcePath = "/device/devices";
		deviceFilter = ",deviceType:0|4|18|19";
		if (mapSourceType == "services") {
			deviceFilter = ",deviceType:6";
		};
	};

	// Set our severity filters to query...
	let statusFilter = "";
	let statusArray = [];
	// if (!showCleared && showWarnings && showErrors && showCriticals) {
	if (showCleared) {
		statusArray.push("none");
	};
	if (showWarnings) {
		statusArray.push("*warn*");
	};
	if (showErrors) {
		statusArray.push("*error*");
	};
	if (showCriticals) {
		statusArray.push("*critical*");
	};
	if (statusArray.length > 0) {
		statusFilter = ',alertStatus:' + '"' + statusArray.join("|") + '"';
	};
	if (!showSDT) {
		statusFilter = statusFilter + ',sdtStatus:"none-none-*"';
	}

	// Reset our zoom level when the filter options change...
	if (centerCalculated && autoZoom && !timedRefresh) {
		centerCalculated = false;
	};

	// Start fetching data from LM that have location in custom properties, paginating the data as necessary...
	try {
		while (offset < totalGroups) {
			// let queryParams = `?v=3&size=1000&offset=${offset}&fields=${fieldList}&filter=fullPath${pathOperator}"${groupPathFilter}"${statusFilter}${deviceFilter}`;
			let queryParams = `?v=3&size=1000&offset=${offset}&fields=${fieldList}&filter=customProperties.name:"location",fullPath${pathOperator}"${groupPathFilter}"${statusFilter}${deviceFilter}`;

			// The 'fullpath' attribute only exists for group queries - for devices & services we'll use 'system.groups' instead...
			if (mapSourceType != "groups") {
				if (groupPathFilter != "*") {
					// Strip off leading or trailing asterisks since they're not needed in this case...
					let tmpPathFilter = groupPathFilter.replace(/^\*/, "").replace(/\*$/, "");
					if (tmpPathFilter != "") {
						// queryParams = '?v=3&size=1000&offset=' + offset + '&filter=systemProperties~"{\\"name\\":\\"system.groups\\",\\"value\\":\\"*' + tmpPathFilter + '*\\"}"' + statusFilter + deviceFilter;
						queryParams = '?v=3&size=1000&offset=' + offset + '&filter=customProperties.name:"location",systemProperties~"{\\"name\\":\\"system.groups\\",\\"value\\":\\"*' + tmpPathFilter + '*\\"}"' + statusFilter + deviceFilter;
					};
				} else {
					queryParams = '?v=3&size=1000&offset=' + offset + '&filter=customProperties.name:"location"' + statusFilter + deviceFilter;
				};
			};

			// Call the LogicMonitor API to get a list of groups...
			const markerData = await LMClient({
				resourcePath: resourcePath,
				queryParams: queryParams,
				httpVerb: httpVerb,
				postBody: null,
				apiVersion: '3',
				signal: refreshSignal, // Allow cancellation of in-progress requests
			});
			// Process the group data we received...
			// console.debug('Group request succeeded with JSON response', markerData);

			if (markerData.total != 0) {
				if (markerData.total != totalGroups) {
					totalGroups = markerData.total;
				};

				groupData = groupData.concat(markerData.items);

				offset = groupData.length;

				// Display our progress to the user...
				_dom.refreshStatusArea.innerHTML = loadingSpinner + "&nbsp;Updating: " + offset + " of " + totalGroups + " (" + Math.round(offset/totalGroups*100) + "%)";
				// _dom.refreshStatusArea.innerHTML = "Updating: " + Math.round(offset/totalGroups*100) + "%";
			} else {
				// Indicate that no results were found...
				if (offset == 0) {
					console.debug('No results found');
					_dom.refreshStatusArea.innerHTML = "<span class='noResultMessage'>No results</span>";
					totalGroups = -1; // Stop the loop
					// Re-enable the toolbar fields...
					_dom.mapOptionsArea.classList.remove("disabled");
					if (_dom.weatherRefreshButton) {
						_dom.weatherRefreshButton.classList.remove("disabled");
					}

					// Clear any previous markers from the map...
					for (let i = 0; i < markers.length; i++) {
						markers[i].setMap(null);
					};
					markers = [];
					if (typeof clusterer == "object") {
						clusterer.setMap(null);
					};

					// Reset the map zoom...
					bounds = new google.maps.LatLngBounds();
					resetZoom();
					centerCalculated = false;
				};
			};
		};


		// Start fetching data from LM that have location in inherited properties, paginating the data as necessary...
		// Inherited properties don't apply to groups, so skip this if not looking at resources and/or services...
		// console.debug('totalGroups: ' + totalGroups);
		if (mapSourceType != "groups" && pollInheritedLocations) {
			offset = 0;
			let tmpTotalGroups = 1000;
			while (offset < tmpTotalGroups) {
				// let queryParams = `?v=3&size=1000&offset=${offset}&fields=${fieldList}&filter=fullPath${pathOperator}"${groupPathFilter}"${statusFilter}${deviceFilter}`;
				let queryParams = `?v=3&size=1000&offset=${offset}&fields=${fieldList}&filter=inheritedProperties.name:"location",fullPath${pathOperator}"${groupPathFilter}"${statusFilter}${deviceFilter}`;

				// The 'fullpath' attribute only exists for group queries - for devices & services we'll use 'system.groups' instead...
				if (groupPathFilter != "*") {
					// Strip off leading or trailing asterisks since they're not needed in this case...
					let tmpPathFilter = groupPathFilter.replace(/^\*/, "").replace(/\*$/, "");
					if (tmpPathFilter != "") {
						// queryParams = '?v=3&size=1000&offset=' + offset + '&filter=systemProperties~"{\\"name\\":\\"system.groups\\",\\"value\\":\\"*' + tmpPathFilter + '*\\"}"' + statusFilter + deviceFilter;
						queryParams = '?v=3&size=1000&offset=' + offset + '&filter=inheritedProperties.name:"location",systemProperties~"{\\"name\\":\\"system.groups\\",\\"value\\":\\"*' + tmpPathFilter + '*\\"}"' + statusFilter + deviceFilter;
					};
				} else {
					queryParams = '?v=3&size=1000&offset=' + offset + '&filter=inheritedProperties.name:"location"' + statusFilter + deviceFilter;
				};
				// console.debug("Query params for inherited locations: " + queryParams);

				// Call the LogicMonitor API to get a list of groups...
				const markerData = await LMClient({
					resourcePath: resourcePath,
					queryParams: queryParams,
					httpVerb: httpVerb,
					postBody: null,
					apiVersion: '3',
					signal: refreshSignal, // Allow cancellation of in-progress requests
				});
				// Process the group data we received...
				// console.debug('Group request succeeded with JSON response', markerData);

				// console.debug("Inherited locations found: " + markerData.total);
				if (markerData.total != 0) {
					if (markerData.total != tmpTotalGroups) {
						tmpTotalGroups = markerData.total;
						if (totalGroups >= 0) {
							totalGroups = totalGroups + markerData.total;
						} else {
							totalGroups = markerData.total;
						};
					};

					groupData = groupData.concat(markerData.items);

					offset = groupData.length;

					// Display our progress to the user...
					_dom.refreshStatusArea.innerHTML = loadingSpinner + "&nbsp;Updating: " + offset + " of " + tmpTotalGroups + " (" + Math.round(offset/tmpTotalGroups*100) + "%)";
					// _dom.refreshStatusArea.innerHTML = "Updating: " + Math.round(offset/totalGroups*100) + "%";
				} else {
					// We're done so stop the loop...
					// console.debug("We're done fetching inherited locations");
					tmpTotalGroups = 0;
					offset = totalGroups;
					break;
				};
			};
			// console.debug("totalGroups: " + totalGroups + " / tmpTotalGroups: " + tmpTotalGroups + " / offset: " + offset);
		};
	} catch (error) {
		// Silently handle aborted requests (user triggered a new refresh)
		if (error.name === 'AbortError') {
			console.debug('Refresh operation was cancelled.');
			return; // Exit early, new refresh will take over
		}
		console.error('Error fetching group data:', error);
		_dom.refreshStatusArea.innerHTML = `<span class='noResultMessage'>Error loading data: ${error.message || 'Unknown error'}</span>`;
		totalGroups = -1; // Stop the loop on error
		// Re-enable the toolbar fields...
		_dom.mapOptionsArea.classList.remove("disabled");
		if (_dom.weatherRefreshButton) {
			_dom.weatherRefreshButton.classList.remove("disabled");
		}
	}

	// If we've finished fetching all the group/resource data...
	if (offset == totalGroups) {
		// console.debug('Total groups processed: ' + totalGroups);
		// Reset our progress indicator...
		_dom.refreshStatusArea.innerHTML = "";
		_dom.refreshStatusArea.style.display = "none";
		// Re-enable the toolbar fields...
		_dom.mapOptionsArea.classList.remove("disabled");
		if (_dom.weatherRefreshButton) {
			_dom.weatherRefreshButton.classList.remove("disabled");
		}

		// Prepare Google geocoding for translating a street address to latitude & longitude...
		const geocoder = new google.maps.Geocoder();
		const parser = new DOMParser();

		let itemsProcessed = 0;

		// Clear any previous markers from the map...
		for (let i = 0; i < markers.length; i++) {
			markers[i].setMap(null);
		};
		markers = [];

		// For use in zooming the map to encompass all our markers on initial draw...
		bounds = new google.maps.LatLngBounds();

		// Start looping through the groups...
		groupData.forEach((thisItem) => {
			let groupID = thisItem.id;
			let highestSeverity = "";
			let sdtStatus = "";

			// Parse the alarm status...
			let alertStatusArray = thisItem.alertStatus.match(/([\w]+)-([\w]+)-([\w]+)/);
			if (alertStatusArray) {
				let alertStatus = alertStatusArray[1];
				let alertSeverity = alertStatusArray[2];

				if ((alertSeverity == "warn" && highestSeverity == "") || (alertSeverity == "error" && highestSeverity != "critical") || (alertSeverity == "critical")) {
					highestSeverity = alertSeverity;
				};
			};
			// Parse the SDT status...
			let sdtStatusArray = thisItem.sdtStatus.match(/([\w]+)-([\w]+)-([\w]+)/);
			if (sdtStatusArray[1].toLowerCase() == "sdt" || sdtStatusArray[2].toLowerCase() == "sdt") {
				sdtStatus = "sdt";
			};

			// Variables for each severity...
			// The SVG icon for the group's severity...
			let sevIcon = clearedIcon;
			// We'll use the pin's z-index to reflect the group's severity for use with marker clustering...
			let pinIndex = 0;
			if (highestSeverity != "") {
				if (highestSeverity == "warn") {
					sevIcon = warningIcon;
					pinBG = "#f5ca1d";
					pinBorder = "#967c14";
					pinIndex = 1;
				} else if (highestSeverity == "error") {
					sevIcon = errorIcon;
					pinBG = "#ff8c00";
					pinBorder = "#ac5101";
					pinIndex = 2;
				} else if (highestSeverity == "critical") {
					sevIcon = criticalIcon;
					pinBG = "#e0351b";
					pinBorder = "#9a2614";
					pinIndex = 3;
				};
			} else {
				highestSeverity = "clear";
			};

			// If in SDT...
			if (sdtStatus == "sdt") {
				highestSeverity = "sdt";
				sevIcon = sdtIcon;
				pinBG = "#00a1fe";
				pinBorder = "#00a1fe";
				pinIndex = 4;
			};

			// Get the group's location (hopefully an address)...
			let address = "";
			let latProp = "";
			let lngProp = "";
			alreadyGeocoded = false;
			// First check to see if the location is in custom properties (defined on the group/resource itself)...
			if (fullRefresh) {
				try {
					address = thisItem.customProperties.find((locationProp) => locationProp.name.toLowerCase() === "location").value;

					// See if there are custom properties for latitude and longitude...
					if (!ignoreLatLongProps) {
						latProp = thisItem.customProperties.find((locationProp) => locationProp.name.toLowerCase() === "latitude");
						lngProp = thisItem.customProperties.find((locationProp) => locationProp.name.toLowerCase() === "longitude");
						if (latProp && lngProp) {
							let latVal = Number(latProp.value);
							let lngVal = Number(lngProp.value);
							if (latVal > -90 && latVal < 90 && lngVal > -180 && lngVal < 180) {
								// address = `${latProp.value}, ${lngProp.value}`;
								alreadyGeocoded = true;
							};
						};
					};
				} catch(e) {
					try {
						// If not found in custom properties, try to get it from inherited properties...
						address = thisItem.inheritedProperties.find((locationProp) => locationProp.name.toLowerCase() === "location").value;

						// See if there are inherited properties for latitude and longitude...
						if (!ignoreLatLongProps) {
							latProp = thisItem.inheritedProperties.find((locationProp) => locationProp.name.toLowerCase() === "latitude");
							lngProp = thisItem.inheritedProperties.find((locationProp) => locationProp.name.toLowerCase() === "longitude");
							if (latProp && lngProp) {
								let latVal = Number(latProp.value);
								let lngVal = Number(lngProp.value);
								if (latVal > -90 && latVal < 90 && lngVal > -180 && lngVal < 180) {
									// address = `${latProp.value}, ${lngProp.value}`;
									alreadyGeocoded = true;
								};
							};
						};
					} catch(y) {
						// console.log("No address found for " + thisItem.name);
						// totalGroups = totalGroups - 1;
					};
				};
			};

			// Remove any extraneous characters from the address...
			address = address.trim().replaceAll("\t", "").replaceAll("\n", ", ");

			resolveAddress(thisItem, address);

			// Resolve locations to latitude/longitude...
			async function resolveAddress(thisItem, address) {
				// console.debug('Resolving address for ' + thisItem.name + ': ' + address);
				// Check to see if we've already geocoded this group's address and that the address hasn't changed...
				if (cachedAddresses[thisItem.id] && cachedAddresses[thisItem.id].address == address) {
					// console.debug('Address already geocoded for ' + thisItem.name + ': ' + address);
					// Call the subfunction to add the group to the map...
					plotMarker(thisItem, cachedAddresses[thisItem.id].lat, cachedAddresses[thisItem.id].lng, cachedAddresses[thisItem.id].address);
				} else {
					if (alreadyGeocoded) {
						// console.debug('Address already geocoded as custom properties for ' + thisItem.name + ': ' + address);
						// Cache the address for reuse...
						cachedAddresses[thisItem.id] = {lat: Number(latProp.value), lng: Number(lngProp.value), address: address};
						saveCache();
						// Call the subfunction to add the group to the map...
						plotMarker(thisItem, cachedAddresses[thisItem.id].lat, cachedAddresses[thisItem.id].lng, cachedAddresses[thisItem.id].address);
					} else {
						// See if the location is a latitude/longitude...
						const coodinateRE = /^([\-]*[\d]+[\.\d]+)[ ,]+([\-]*[\d]+[\.\d]+)$/;
						let match = coodinateRE.exec(address);
						let latVal = null;
						let lngVal = null;
						if (match && match.length == 3) {
							try {
								latVal = Number(match[1]);
								lngVal = Number(match[2]);
							} catch(e) {};
							// It appears we have a latitude & longitude. Cache them for reuse...
							latVal = Number(match[1]);
							lngVal = Number(match[2]);
						};
						// Ensure the latitude and longitude are valid...
						if (latVal && lngVal && latVal > -90 && latVal < 90 && lngVal > -180 && lngVal < 180 && latVal != 0 && lngVal != 0) {
							// console.debug('Latitude & longitude found for ' + thisItem.name + ': ' + match[1] + ', ' + match[2]);
							cachedAddresses[thisItem.id] = {lat: Number(match[1]), lng: Number(match[2]), address: address};
							saveCache();
							// Call the subfunction to add the group to the map...
							plotMarker(thisItem, cachedAddresses[thisItem.id].lat, cachedAddresses[thisItem.id].lng, address);
						} else {
							// Attempt to geocode the address...
							geocoder.geocode( {'address': address}, function(results, status) {
								if (status == 'OK') {
									// Grab the longitude/latitude from the results...
									let geocodedLocation = results[0].geometry.location;

									// Cache these coordinates for reuse later...
									cachedAddresses[thisItem.id] = {lat: Number(geocodedLocation.lat()), lng: Number(geocodedLocation.lng()), address: address};
									saveCache();
									// Call the subfunction to add the group to the map...
									plotMarker(thisItem, cachedAddresses[thisItem.id].lat, cachedAddresses[thisItem.id].lng, address);
								} else {
									// We weren't provided a resolvable address, so deduct this item from our overall count...
									totalGroups = totalGroups - 1;
									// We still call the `plotMarker` even though there's no marker to plot in case this was the last one to process...
									plotMarker(thisItem, null, null, null);
								};
							});
						};
					};
				};
			};

			// Subfunction to add markers to the map...
			async function plotMarker(thisItem, lat, lng, address) {
				if (address != null) {
					// Start creating content for the group's map pin...
					const content = document.createElement("div");
					let customContent = "";

					// Search the item's properties for any specified to display...
					if (displayProps != "") {
						const propList = displayProps.split(",");
						propList.forEach(thisProp => {
							// Check the custom properties...
							if (thisItem.customProperties) {
								let propArray = thisItem.customProperties.filter(item => item.name == thisProp.trim());
								if (propArray.length == 1) {
									customContent = `${customContent}<div class="customItem"><span class="customItemName">${propArray[0].name}</span>: ${propArray[0].value}</div>`;
								// Check inherited properties...
								} else if (thisItem.inheritedProperties) {
									propArray = thisItem.inheritedProperties.filter(item => item.name == thisProp.trim());
									if (propArray.length == 1) {
										customContent = `${customContent}<div class="customItem"><span class="customItemName">${propArray[0].name}</span>: ${propArray[0].value}</div>`;
									// Check auto properties...
									} else if (thisItem.autoProperties) {
										propArray = thisItem.autoProperties.filter(item => item.name == thisProp.trim());
										if (propArray.length == 1) {
											customContent = `${customContent}<div class="customItem"><span class="customItemName">${propArray[0].name}</span>: ${propArray[0].value}</div>`;
										};
									};
								};
							};
						});
						if (customContent != "") {
							customContent = `<div class="customItemArea">${customContent}</div>`;
						};
					};


					// Look to see if connecting line info has been provided...
					if (thisItem.autoProperties) {
						let propArray = thisItem.autoProperties.filter(item => item.name == connectionInfoProp);
						if (propArray.length == 1) {
							// Multiple connections to an endpoint can be specifed by separating them with a semicolon...
							const connectionItems = propArray[0].value.split(";");

							// Loop through the connections...
							connectionItems.forEach(thisConnection => {
								// Split the comma-separated parameters...
								let params = thisConnection.split(",");

								if (params.length > 0) {
									let tmp = {};
									tmp.connectionName = params[0].trim();
									tmp.datasourceID = params[1].trim();
									tmp.instanceID = params[2].trim();
									tmp.deviceIDSource = thisItem.id;
									tmp.deviceIDConnected = params[3].trim();
									// TODO: Maybe add support for another parameter for the source device ID to support group connections.

									lineData[`${tmp.deviceIDSource}${tmp.deviceIDConnected}`] = tmp;
									// lineData[tmp.deviceIDSource + ":" + tmp.deviceIDConnected] = tmp;
								};
							});
						};
					};

					content.classList.add("group");
					// The pin's z-index gets overwritten when clicked to show details, so capture the original severity in the pin's metadata...
					content.dataset.severity = pinIndex;
					// Create the content shown when the pin is clicked...
					if (mapSourceType == "groups") {
						// Capture the group's description...
						let groupDescription = thisItem.description;
						// If the group doesn't have a description then fallback to showing the address...
						if (groupDescription == "") {
							groupDescription = address;
						};

						content.innerHTML = `
							<div class="icon ${highestSeverity}">
								${sevIcon}
							</div>
							<div class="details">
								<div class="groupName"><a href="/santaba/uiv4/resources/treeNodes/t-dg,id-${thisItem.id}?source=details" target="_blank">${thisItem.name}</a></div>
								<div class="description">${groupDescription}${customContent}</div>
								<div class="features">
									<div title="${thisItem.numOfHosts} Standard Devices">
										<svg xmlns="http://www.w3.org/2000/svg" class="infoDialogIcon" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M160 96C124.7 96 96 124.7 96 160L96 224C96 259.3 124.7 288 160 288L480 288C515.3 288 544 259.3 544 224L544 160C544 124.7 515.3 96 480 96L160 96zM376 168C389.3 168 400 178.7 400 192C400 205.3 389.3 216 376 216C362.7 216 352 205.3 352 192C352 178.7 362.7 168 376 168zM432 192C432 178.7 442.7 168 456 168C469.3 168 480 178.7 480 192C480 205.3 469.3 216 456 216C442.7 216 432 205.3 432 192zM160 352C124.7 352 96 380.7 96 416L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 416C544 380.7 515.3 352 480 352L160 352zM376 424C389.3 424 400 434.7 400 448C400 461.3 389.3 472 376 472C362.7 472 352 461.3 352 448C352 434.7 362.7 424 376 424zM432 448C432 434.7 442.7 424 456 424C469.3 424 480 434.7 480 448C480 461.3 469.3 472 456 472C442.7 472 432 461.3 432 448z"/></svg>

										<span>${thisItem.numOfHosts}</span>
									</div>
									<div title="${thisItem.numOfAWSDevices + thisItem.numOfAzureDevices + thisItem.numOfGcpDevices} Cloud Devices">
										<svg xmlns="http://www.w3.org/2000/svg" class="infoDialogIcon" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M32 400C32 479.5 96.5 544 176 544L480 544C550.7 544 608 486.7 608 416C608 364.4 577.5 319.9 533.5 299.7C540.2 286.6 544 271.7 544 256C544 203 501 160 448 160C430.3 160 413.8 164.8 399.6 173.1C375.5 127.3 327.4 96 272 96C192.5 96 128 160.5 128 240C128 248 128.7 255.9 129.9 263.5C73 282.7 32 336.6 32 400z"/></svg>
										<span>${thisItem.numOfAWSDevices + thisItem.numOfAzureDevices + thisItem.numOfGcpDevices}</span>
									</div>
									<div title="${thisItem.numOfKubernetesDevices} Kubernetes Devices">
										<svg xmlns="http://www.w3.org/2000/svg" class="infoDialogIcon" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M401.8 269.7L450.4 227.2C464.2 246.5 473.8 269.1 477.8 293.4L413.4 297.7C411 287.6 407 278.2 401.8 269.7zM541.9 289.2C536.6 250.4 521.3 214.7 498.7 184.9L499.5 184.2C513 172.4 513.7 151.6 501 139C488.3 126.4 467.6 127 455.8 140.5L455.1 141.3C425.3 118.7 389.6 103.4 350.8 98.1L350.9 97C352.1 79.1 337.9 64 320 64C302.1 64 287.9 79.2 289.1 97L289.2 98.1C250.4 103.4 214.7 118.7 184.9 141.3L184.2 140.5C172.4 127 151.6 126.3 139 139C126.4 151.7 127 172.4 140.5 184.2L141.3 184.9C118.7 214.7 103.4 250.4 98.1 289.2L97 289.1C79.1 287.9 64 302.1 64 320C64 337.9 79.2 352.1 97 350.9L98.1 350.8C103.4 389.6 118.7 425.3 141.3 455.1L140.5 455.8C127 467.6 126.3 488.4 139 501C151.7 513.6 172.4 513 184.2 499.5L184.9 498.7C214.7 521.3 250.4 536.6 289.2 541.9L289.1 543C287.9 560.9 302.1 576 320 576C337.9 576 352.1 560.8 350.9 543L350.8 541.9C389.6 536.6 425.3 521.3 455.1 498.7L455.8 499.5C467.6 513 488.3 513.7 501 501C513.7 488.3 513 467.6 499.5 455.8L498.7 455.1C521.3 425.3 536.6 389.6 541.9 350.8L543 350.9C560.9 352.1 576 337.9 576 320C576 302.1 560.8 287.9 543 289.1L541.9 289.2zM227.2 189.6C246.5 175.8 269.1 166.2 293.4 162.1L297.7 226.5C287.7 228.9 278.2 232.9 269.7 238.1L227.2 189.5zM162.2 293.4C166.3 269 175.9 246.5 189.7 227.2L238.3 269.7C233 278.2 229.1 287.7 226.7 297.7L162.3 293.4zM189.7 412.8C175.9 393.5 166.3 370.9 162.2 346.6L226.6 342.3C229 352.4 233 361.8 238.2 370.3L189.6 412.8zM293.5 477.8C269.1 473.7 246.6 464.1 227.3 450.4L269.8 401.8C278.3 407.1 287.8 411 297.8 413.4L293.5 477.8zM412.9 450.4C393.6 464.2 371 473.8 346.7 477.8L342.4 413.4C352.4 411 361.9 407 370.4 401.8L412.9 450.4zM477.9 346.6C473.8 371 464.2 393.5 450.5 412.8L401.9 370.3C407.2 361.7 411.1 352.3 413.5 342.3L477.9 346.6zM412.9 189.7L370.4 238.3C361.8 233 352.4 229.1 342.4 226.7L346.7 162.3C371.1 166.4 393.6 176 412.9 189.8zM320 288C337.7 288 352 302.3 352 320C352 337.7 337.7 352 320 352C302.3 352 288 337.7 288 320C288 302.3 302.3 288 320 288z"/></svg>
										<span>${thisItem.numOfKubernetesDevices}</span>
									</div>
									<div class="drillDownButton" title="Open group in new tab">
										<svg xmlns="http://www.w3.org/2000/svg" class="infoDialogIcon" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="white" d="M384 64C366.3 64 352 78.3 352 96C352 113.7 366.3 128 384 128L466.7 128L265.3 329.4C252.8 341.9 252.8 362.2 265.3 374.7C277.8 387.2 298.1 387.2 310.6 374.7L512 173.3L512 256C512 273.7 526.3 288 544 288C561.7 288 576 273.7 576 256L576 96C576 78.3 561.7 64 544 64L384 64zM144 160C99.8 160 64 195.8 64 240L64 496C64 540.2 99.8 576 144 576L400 576C444.2 576 480 540.2 480 496L480 416C480 398.3 465.7 384 448 384C430.3 384 416 398.3 416 416L416 496C416 504.8 408.8 512 400 512L144 512C135.2 512 128 504.8 128 496L128 240C128 231.2 135.2 224 144 224L224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160L144 160z"/></svg></a>
									</div>
								</div>
							</div>
						`;
					} else {
						// Capture the group's description...
						let groupDescription = thisItem.description;
						// If the group doesn't have a description then fallback to showing the address...
						if (groupDescription == "") {
							groupDescription = "Host:" + thisItem.name + "<br/>Address: " + cachedAddresses[groupID].address;
						};

						content.innerHTML = `
							<div class="icon ${highestSeverity}">
								${sevIcon}
							</div>
							<div class="details">
								<div class="groupName"><a href="/santaba/uiv4/resources/treeNodes/t-d,id-${thisItem.id}?source=details&tab=alert" target="_blank">${thisItem.displayName}</a></div>
								<div class="description">${groupDescription}${customContent}</div>
								<div class="features">
									<div class="drillDownButton" title="Open group in new tab">
										<a href="/santaba/uiv4/resources/treeNodes/t-d,id-${thisItem.id}?source=details&tab=alert" target="_blank" class="link"><svg xmlns="http://www.w3.org/2000/svg" class="infoDialogIcon" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path fill="white" d="M384 64C366.3 64 352 78.3 352 96C352 113.7 366.3 128 384 128L466.7 128L265.3 329.4C252.8 341.9 252.8 362.2 265.3 374.7C277.8 387.2 298.1 387.2 310.6 374.7L512 173.3L512 256C512 273.7 526.3 288 544 288C561.7 288 576 273.7 576 256L576 96C576 78.3 561.7 64 544 64L384 64zM144 160C99.8 160 64 195.8 64 240L64 496C64 540.2 99.8 576 144 576L400 576C444.2 576 480 540.2 480 496L480 416C480 398.3 465.7 384 448 384C430.3 384 416 398.3 416 416L416 496C416 504.8 408.8 512 400 512L144 512C135.2 512 128 504.8 128 496L128 240C128 231.2 135.2 224 144 224L224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160L144 160z"/></svg></a>
									</div>
								</div>
							</div>
						`;
					};

					// Add this group's pin to the map...
					let marker = new google.maps.marker.AdvancedMarkerElement({
						position: { lat: cachedAddresses[groupID].lat, lng: cachedAddresses[groupID].lng },
						map: map,
						content: content,
						// content: glyphSvgPinElement.element,
						title: thisItem.name,
						zIndex: pinIndex,
					});
					// Store deviceID on marker for polyline lookups...
					marker.deviceID = thisItem.id;

					// Open info window when marker is clicked...
					marker.addListener("gmp-click", () => {
						toggleHighlight(marker, thisItem)
					});

					// Add reference to this pin for use by the clustering algorithm or if we need to modify them later...
					markers.push(marker);

					// Add this marker to map's bounding box (for initial zooming)...
					bounds.extend(marker.position);

					itemsProcessed = itemsProcessed + 1;
				};
				// console.log("itemsProcessed: " + itemsProcessed + " / totalGroups: " + totalGroups);

				// If all items have been processed, initialize the marker cluster...
				if (itemsProcessed == totalGroups) {
					// If this is the first time drawing the map, center the map based on our markers...
					if (!centerCalculated || (timedRefresh && autoResetMapOnRefresh)) {
						resetZoom();
						centerCalculated = true;
					};

					if (!disableClustering) {
						// Reset our marker clustering on refreshes...
						if (typeof clusterer == "object") {
							google.maps.event.clearInstanceListeners(clusterer);
							clusterer.setMap(null);
						};
						// We'll use MarkerCluster's SuperClusterAlgorithm since it's more optimized (the radius is to prevent overlap of clusters & markers)...
						const algorithm = new markerClusterer.SuperClusterAlgorithm({radius: 120});
						// Initialize our marker clusters...
						clusterer = new markerClusterer.MarkerClusterer({
							markers,
							map,
							renderer,
							algorithm,
							onClusterClick: () => {} // Override default zoom behavior
						});
						// Redraw connecting lines when clusters change
						clusterer.addListener("clusteringend", () => {
							updatePolylineEndpoints();
						});
					};

					// Plot any connecting lines between resources...
					if (mapSourceType == "resources") {
						// Clear any existing connecting lines before drawing new ones
						clearAllPolylines();
						lineData.forEach(thisConnection => {
							// Look to see if connecting point exists on the map...
							if (cachedAddresses[thisConnection.deviceIDConnected]) {
								// Plot the connection on the map...
								plotConnection(thisConnection);
							};
						});
						// After drawing, ensure endpoints point to current marker/cluster locations
						updatePolylineEndpoints();
					};

					// Our refresh is now complete, so capture how long it took...
					let refreshEndTime = performance.now();
					console.debug(`Total map refresh time: ${refreshEndTime - refreshStartTime} milliseconds`);
					pollCount = pollCount + 1;
					if (fullRefresh) {
						fullRefresh = false;
					};

					// Carry forward our tilt/heading between refreshes...
					map.setTilt(mapTilt);
					map.setHeading(mapHeading);
				};
			};
		});
	};
};

// Function to fetch connection status & plot connecting lines on the map...
async function plotConnection(connection) {
	// Establish coordinates of the line start and end...
	const tmpCoords = [
		{ lat: cachedAddresses[connection.deviceIDSource].lat, lng: cachedAddresses[connection.deviceIDSource].lng},
		{ lat: cachedAddresses[connection.deviceIDConnected].lat, lng: cachedAddresses[connection.deviceIDConnected].lng}
	];

	// Fetch the current alert status of the defined instance...
	let resourcePath = `/device/devices/${connection.deviceIDSource}/devicedatasources/${connection.datasourceID}/instances/${connection.instanceID}`;
	let httpVerb = "GET";
	const instanceData = await LMClient({
		resourcePath: resourcePath,
		queryParams: "",
		httpVerb: httpVerb,
		postBody: null,
		apiVersion: '3',
	});
	// console.debug('Instance status succeeded with JSON response', instanceData);

	// Process the data we received...
	if (instanceData) {
		let alertStatus = "OK";
		let alertSeverity = "clear";
		let sdtStatus = "";
		let connectionColor = "#85c25d";
		// Parse the alarm status...
		let alertStatusArray = instanceData.alertStatus.match(/([\w]+)-([\w]+)-([\w]+)/);
		if (alertStatusArray) {
			alertStatus = alertStatusArray[1];
			alertSeverity = alertStatusArray[2];
		};

		// Determine color by severity...
		if (alertSeverity != "") {
			if (alertSeverity == "warn") {
				connectionColor = "#f5ca1d";
				alertStatus = "Warning";
			} else if (alertSeverity == "error") {
				connectionColor = "#ff8c00";
				alertStatus = "Error";
			} else if (alertSeverity == "critical") {
				connectionColor = "#e0351b";
				alertStatus = "Critical";
			};
		};

		// Parse the SDT status...
		let sdtStatusArray = instanceData.sdtStatus.match(/([\w]+)-([\w]+)-([\w]+)/);
		if (sdtStatusArray[1].toLowerCase() == "sdt" || sdtStatusArray[2].toLowerCase() == "sdt") {
			sdtStatus = "sdt";
		};
		// If in SDT...
		if (sdtStatus == "sdt") {
			connectionColor = "#00a1fe";
		};

		// Plot the line on the map...
		const thisPath = new google.maps.Polyline({
			path: tmpCoords,
			geodesic: useGeodesicLines,
			strokeColor: connectionColor,
			strokeOpacity: 1.0,
			strokeWeight: connectingLineWeight,
		});
		thisPath.setMap(map);

		// Track polyline with source/target IDs so we can redraw to clusters
		polylines.push({
			polyline: thisPath,
			sourceDeviceID: connection.deviceIDSource,
			targetDeviceID: connection.deviceIDConnected,
			originalCoords: tmpCoords
		});

		// Show connection info on hover...
		let lineInfoWindow = new google.maps.InfoWindow({
			content: ""
		});

		google.maps.event.addListener(thisPath, "mouseover", function(e) {
			lineInfoWindow.setPosition(e.latLng);
			lineInfoWindow.setContent(`<strong>${connection.connectionName}</strong><br/>Connection alert status: <a href="/santaba/uiv4/resources/treeNodes/t-i,id-${connection.instanceID}?source=details&tab=alert" target="_blank" title="Click to view alerts" style="border: 0;">${alertStatus}</a>`);
			lineInfoWindow.setHeaderDisabled(true);
			lineInfoWindow.open(map);
		});
		google.maps.event.addListener(thisPath, "mouseout", function(e) {
			lineInfoWindow.close();
		});
		google.maps.event.addListener(thisPath, "click", function(e) {
			window.open("/santaba/uiv4/resources/treeNodes/t-i,id-" + connection.instanceID + "?source=details&tab=alert");
		});
		// Ensure new polylines handle clusters properly...
		updatePolylineEndpoints();
	};
};

// Function for showing/hiding a group's detail when clicked...
function toggleHighlight(markerView, group) {
	// Close any open cluster details...
	if (clusterInfoWindow) {
		clusterInfoWindow.close();
	};
	if (markerView.content.classList.contains("highlight")) {
		markerView.content.classList.remove("highlight");
		markerView.content.parentElement.style.setProperty("z-index", Number(markerView.content.dataset.severity));
	} else {
		let foo = document.querySelectorAll('.highlight');
		if (foo.length > 0) {
			foo[0].classList.remove("highlight");
			foo[0].parentElement.style.setProperty("z-index", Number(foo[0].dataset.severity));
		};

		markerView.content.parentElement.style.setProperty("z-index", 10);
		markerView.content.classList.add("highlight");
	};
};

// Function processing status of Fetch calls...
function status(response) {
	if (response.status >= 200 && response.status < 300) {
		return Promise.resolve(response);
	} else {
		return Promise.reject(new Error(response.statusText));
	};
};


// Pre-processor for JSON responses from Fetch calls...
function json(response) {
	return response.json();
};

// Our custom renderer for MarkerClusterer to create donut charts based on status of clustered items...
const renderer = {
	render ({ markers, count, position }) {
		// Since Google Maps markers don't have direct support for metadata, I'm using the marker's z-index to capture the group's severity: 1=warning, 2=error, 3=critical.

		// Create objects to hold per-severity metrics...
		const severityCounts = new Map([["4",0],["3",0],["2",0],["1",0],["0",0]]);
		const severityPercents = new Map([["4",0],["3",0],["2",0],["1",0]]);
		const severityOffsets = new Map([["4",0],["3",0],["2",0],["1",0]]);

		// Get counts of clustered pins by severity...
		markers.forEach((value, key) => {
			const severity = value.zIndex > 0 ? value.zIndex.toString() : "0";
			severityCounts.set(severity, (severityCounts.get(severity) || 0) + 1);
		});

		// (Credit for the technique I'm using to create SVG donut charts goes to this site: https://heyoka.medium.com/scratch-made-svg-donut-pie-charts-in-html5-2c587e935d72 )

		// Calculate sizes & offsets for our chart...
		// First segment should always have an offset of 25 to have it start at 12:00 on the circle...
		const baseOffset = 25;
		let offsetSum = 0;
		// Calculate percentages for each severity...
		severityPercents.forEach((value, key) => {
			const percent = (severityCounts.get(key)/count) * 100;
			severityPercents.set(key, percent);

			// Calculate offsets needed per chart slice...
			if (percent > 0) {
				if (offsetSum == 0) {
					// This is our first item to chart, so it will establish the offset for subsequent chart slices...
					severityOffsets.set(key, baseOffset);
				} else {
					// Formula for calculating offset after first segment: 100-{sum of length of previous segments} + 25...
					const offset = (100 - offsetSum) + baseOffset;
					severityOffsets.set(key, offset);
				}
				offsetSum = offsetSum + percent;
			}
		});

		// Create an SVG donut chart representing severities of clustered pins...
		const svg = window.btoa(`
			<svg fill="#0000ff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" class="donut">
				<filter id="gaussian-blur" x="-20%" y="-20%" width="140%" height="140%">
					<feDropShadow dx="0" dy="${mapTilt/100+0.4}" stdDeviation="1.3" flood-opacity="0.7" />
				</filter>
				<g filter="url(#gaussian-blur)">
					<!-- Defines the center of the donut... -->
					<circle class="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="#fff"></circle>
					<!-- Our base circle, colored green by default... -->
					<circle class="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#85c25d" stroke-width="7"></circle>
					<!-- First segment should always have an offset of 25 to have it start at 12am on the circle... -->
					<!-- SDTs... -->
					<circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#00a1fe" stroke-width="7" stroke-dasharray="${severityPercents.get("4")} ${100-severityPercents.get("4")}" stroke-dashoffset="${severityOffsets.get("4")}"></circle>
					<!-- Criticals... -->
					<circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e0351b" stroke-width="7" stroke-dasharray="${severityPercents.get("3")} ${100-severityPercents.get("3")}" stroke-dashoffset="${severityOffsets.get("3")}"></circle>
					<!-- Errors... -->
					<circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ff8c00" stroke-width="7" stroke-dasharray="${severityPercents.get("2")} ${100-severityPercents.get("2")}" stroke-dashoffset="${severityOffsets.get("2")}"></circle>
					<!-- Warnings... -->
					<circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#f5ca1d" stroke-width="7" stroke-dasharray="${severityPercents.get("1")} ${100-severityPercents.get("1")}" stroke-dashoffset="${severityOffsets.get("1")}"></circle>
				</g>
			</svg>`);

		// Add the chart to the map...
		const marker = new google.maps.Marker({
			position,
			icon: {
				url: `data:image/svg+xml;base64,${svg}`,
				scaledSize: new google.maps.Size(45, 45),
			},
			label: {
				text: String(count),
				color: "rgba(0,0,0,0.9)",
				// color: "rgba(255,255,255,0.9)",
				fontSize: "12px",
			},
			// adjust zIndex to be above other markers
			zIndex: 1000 + count,
		});

		// Create hover content
		const getInfoContent = () => {
			// Get device details from markers
			const deviceDetails = markers.map(marker => {
				const content = marker.content;
				const iconDiv = content.querySelector('.icon');
				const nameLink = content.querySelector('.groupName a');
				let status = 'clear';
				let sdtStatus = '';
				let statusRank = 0;
				if (iconDiv.classList.contains('critical')) {
					status = 'critical';
					statusRank = 4;
				} else if (iconDiv.classList.contains('error')) {
					status = 'error';
					statusRank = 3;
				} else if (iconDiv.classList.contains('warn')) {
					status = 'warning';
					statusRank = 2;
				};
				if (iconDiv.classList.contains('sdt')) {
					sdtStatus = ' <span class="sdtNote">(in SDT)</span>';
					status = 'sdt';
					statusRank = 1;
				};

				return {
					name: nameLink.textContent,
					link: nameLink.href,
					status,
					sdtStatus,
					statusRank,
					position: marker.position
				};
			});

			// Sort the resources by status, then alphabetically by severity...
			deviceDetails.sort((a,b)=> (b.statusRank - a.statusRank || a.name.localeCompare(b.name)  ));

			// Calculate bounds for the cluster...
			const clusterBounds = new google.maps.LatLngBounds();
			deviceDetails.forEach(device => {
				clusterBounds.extend(device.position);
			});

			return `
				<div class="mapInfoPopupWindow">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
						<div style="font-weight: 600; font-size: 14px;">Cluster Summary</div>
						<button onclick="map.fitBounds(new google.maps.LatLngBounds(
							new google.maps.LatLng(${clusterBounds.getSouthWest().lat()}, ${clusterBounds.getSouthWest().lng()}),
							new google.maps.LatLng(${clusterBounds.getNorthEast().lat()}, ${clusterBounds.getNorthEast().lng()})
						))" style="
							padding: 6px 12px;
							background: #1a73e8;
							color: white;
							border: none;
							border-radius: 4px;
							font-size: 13px;
							cursor: pointer;
							display: flex;
							align-items: center;
							gap: 6px;
							transition: background 0.2s;
						" onmouseover="this.style.background='#1557b0'" onmouseout="this.style.background='#1a73e8'">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
								<circle cx="11" cy="11" r="8"/>
								<line x1="21" y1="21" x2="16.65" y2="16.65"/>
								<line x1="11" y1="8" x2="11" y2="14"/>
								<line x1="8" y1="11" x2="14" y2="11"/>
							</svg>
							Zoom into Cluster
						</button>
					</div>
					<div style="display: grid; gap: 8px; margin-bottom: 16px;">
						<div style="display: flex; align-items: center; gap: 8px;">
							<div style="width: 12px; height: 12px; border-radius: 50%; background: #e0351b;"></div>
							<span>Critical: ${severityCounts.get("3") || 0}</span>
						</div>
						<div style="display: flex; align-items: center; gap: 8px;">
							<div style="width: 12px; height: 12px; border-radius: 50%; background: #ff8c00;"></div>
							<span>Error: ${severityCounts.get("2") || 0}</span>
						</div>
						<div style="display: flex; align-items: center; gap: 8px;">
							<div style="width: 12px; height: 12px; border-radius: 50%; background: #f5ca1d;"></div>
							<span>Warning: ${severityCounts.get("1") || 0}</span>
						</div>
						<div style="display: flex; align-items: center; gap: 8px;">
							<div style="width: 12px; height: 12px; border-radius: 50%; background: #85c25d;"></div>
							<span>Clear: ${severityCounts.get("0") || 0}</span>
						</div>
						<div style="display: flex; align-items: center; gap: 8px;">
							<div style="width: 12px; height: 12px; border-radius: 50%; background: #00a1fe;"></div>
							<span>SDT: ${severityCounts.get("4") || 0}</span>
						</div>
					</div>
					<div style="border-top: 1px solid #eee; padding-top: 12px;">
						<div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">${mapSourceType.replace(/^./, char => char.toUpperCase())} (${count})</div>
						<div style="display: grid; gap: 4px;">
							${deviceDetails.map(device => `
								<div style="display: flex; align-items: center; padding: 4px 8px; background: #f8f9fa; border-radius: 4px; gap: 8px; max-height: 25px;">
									<div style="width: 8px; height: 8px; border-radius: 50%; background: var(--${device.status}-color); flex-shrink: 0;"></div>
									<a href="${device.link}"
										target="_blank"
										style="color: #1a73e8; text-decoration: none; flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
										onmouseover="this.style.textDecoration='underline'"
										onmouseout="this.style.textDecoration='none'">
										${device.name}${device.sdtStatus}
									</a>
									<div style="display: flex; align-items: center;">
										<a href="${device.link}"
											target="_blank"
											style="color: #1a73e8; display: flex; align-items: center; padding: 2px; border-radius: 4px; transition: background 0.2s;"
											onmouseover="this.style.background='#e8f0fe'"
											onmouseout="this.style.background='transparent'">
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
												<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
												<polyline points="15 3 21 3 21 9"/>
												<line x1="10" y1="14" x2="21" y2="3"/>
											</svg>
										</a>
									</div>
								</div>
							`).join('')}
						</div>
					</div>
				</div>
			`;
		};

		// Add hover listener
		marker.addListener('click', () => {
			// Close any other details already open...
			if (clusterInfoWindow) {
				clusterInfoWindow.close();
			};
			let foo = document.querySelectorAll('.highlight');
			if (foo.length > 0) {
				foo[0].classList.remove("highlight");
				foo[0].parentElement.style.setProperty("z-index", Number(foo[0].dataset.severity));
			};
			clusterInfoWindow = new google.maps.InfoWindow();
			clusterInfoWindow.setContent(getInfoContent());
			clusterInfoWindow.open(map, marker);
		});

		return marker;
	}
};

// Function to enable the weather overlays when the appropriate checkbox is selected...
function enableWeather() {
	const weatherCheckbox = document.getElementById("weather");
	const optionsElement = document.getElementById("weatherOptions");
	const showClearedElement = document.getElementById("showCleared");

	if (weatherCheckbox.checked) {
		// Show the overlay options...
		optionsElement.style.display = "inline-flex";
		// Add the weather overlays...
		initWeather();
	} else {
		// Clear the timer that refreshes the weather...
		weatherRefresher = null;
		// Remove any previous overlay to ensure we don't keep stacking layers...
		map.overlayMapTypes.clear();
		map.data.forEach(function(feature) {
			map.data.remove(feature);
		});
		// Hide the overlay options...
		optionsElement.style.display = "none";
	};
};

// Initialize the RainViewer API...
async function initWeather() {
	try {
		const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
		if (!response.ok) {
			throw new Error(`RainViewer API error: ${response.status} ${response.statusText}`);
		}
		// Store the API response for re-use purposes in memory...
		rvAPIData = await response.json();
		addWeatherLayer();
	} catch (error) {
		console.error("Failed to fetch RainViewer weather data:", error);
	}

	// Refresh the weather data at regular intervals (using the 'weatherRefreshMinutes' variable set near the top of this script)...
	weatherRefresher = setInterval(async function() {
		try {
			const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
			if (response.ok) {
				rvAPIData = await response.json();
			}
		} catch (error) {
			console.error("Failed to refresh weather data:", error);
		}
		addWeatherLayer();
		console.log("Weather maps refreshed.");
	}, weatherRefreshMinutes*1000*60);
}

// Get the latest radar frame from RainViewer...
function initRainViewerData() {
	rvMapFrames = rvAPIData.radar.past;
	if (rvAPIData.radar.nowcast) {
		rvMapFrames = rvMapFrames.concat(rvAPIData.radar.nowcast);
		rvLastPastFramePosition = rvAPIData.radar.past.length - 1;
	};
};

// Function to add weather & other optional overlays to the map...
async function addWeatherLayer() {
	const weatherCheckbox = document.getElementById("weather");
	const optionsElement = document.getElementById("weatherOptions");

	if (weatherCheckbox.checked) {
		const mapType = document.querySelector('input[name="weatherType"]:checked').value;
		const optionalMapType = document.querySelector('input[name="otherWeatherOverlays"]:checked').value;

		// Add RainViewer layer if appropriate...
		if (mapType == "radar") {
			// Get the latest radar frame from RainViewer...
			initRainViewerData();

			// The following three lines really only apply if we use RainViewer's satellite imagery, which I'm not currently but left it in here if needed...
			let colorScheme = rvOptionKind == 'satellite' ? 0 : rvOptionColorScheme;
			let smooth = rvOptionKind == 'satellite' ? 0 : rvOptionSmoothData;
			let snow = rvOptionKind == 'satellite' ? 0 : rvOptionSnowColors;

			// Remove any previous overlay to ensure we don't keep stacking layers...
			map.overlayMapTypes.clear();

			// Create the Google Maps layer...
			let myMapType = new google.maps.ImageMapType({
				getTileUrl: function(tile, zoom) {
					return [rvAPIData.host + rvMapFrames[rvLastPastFramePosition].path, 256, zoom, tile.x, tile.y, colorScheme, smooth + '_' + snow + '.png'].join('/');
				},
				tileSize: new google.maps.Size(256, 256),
				opacity: weatherOpacity,
				name : mapType,
				isPng: true
			});

			// Attach the weather layer to our maps widget...
			map.overlayMapTypes.insertAt(0, myMapType);

			// Update the timestamp...
			// document.querySelector("#mapTimestampArea").style.display = "block"; // Unhides the timestamp area.
			// document.getElementById("mapTimestamp").innerHTML = (new Date(rvMapFrames[rvLastPastFramePosition].time * 1000)).toString();

		// Show NEXRAD layers if appropriate...
		} else if (mapType.match(/(nexrad|q2)/g)) {
			// Remove any previous overlay to ensure we don't keep stacking layers...
			map.overlayMapTypes.clear();

			// Create the Google Maps layer...
			let myMapType = new google.maps.ImageMapType({
				getTileUrl: function(tile, zoom) {
					return "http://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/" + mapType + "/" + zoom + "/" + tile.x + "/" + tile.y +".png?"+ (new Date()).getTime();
				},
				tileSize: new google.maps.Size(256, 256),
				opacity: weatherOpacity,
				name: mapType,
				isPng: true
			});

			// Attach the weather layer to our maps widget...
			map.overlayMapTypes.insertAt(0, myMapType);

		// Show OpenWeather layers if appropriate...
		} else if (mapType != "" && openWeatherMapsAPIKey.length >= 32) {
			// Remove any previous overlay to ensure we don't keep stacking layers...
			map.overlayMapTypes.clear();

			// Create the Google Maps layer...
			let myMapType = new google.maps.ImageMapType({
				getTileUrl: function(coord, zoom) {
					return "https://tile.openweathermap.org/map/" + mapType + "/" + zoom + "/" + coord.x + "/" + coord.y + ".png?appid=" + openWeatherMapsAPIKey;
				},
				tileSize: new google.maps.Size(256, 256),
				maxZoom: 9,
				minZoom: 0,
				opacity: weatherOpacity,
				name: mapType
			});

			// Attach the weather layer to our maps widget...
			map.overlayMapTypes.insertAt(0, myMapType);
		};

		// Look to see if we should add wildfire into the map...
		// if (mapTitle.match(/fire/gi)) {
		if (optionalMapType == "us-fires") {
			// Clear any previous load of the wildfire data...
			map.data.forEach(function(feature) {
				map.data.remove(feature);
			});
			if (typeof parent.fireInfoWindowListenerHandle == "object") {
				google.maps.event.removeListener(parent.fireInfoWindowListenerHandle);
			};
			if (typeof parent.outageInfoWindowListenerHandle == "object") {
				google.maps.event.removeListener(parent.outageInfoWindowListenerHandle);
			};
			if (typeof parent.quakeInfoWindowListenerHandle == "object") {
				google.maps.event.removeListener(parent.quakeInfoWindowListenerHandle);
			};

			// Load the wildfire data from the ArcGIS site...
			// More info about this source of active US wildfire data can be found at: https://www.arcgis.com/home/item.html?id=d957997ccee7408287a963600a77f61f
			// From that site, you can click "View" above the "URL" field on the right-hand side. From there, you'll see info on the two available layers. We're using layer "1" for perimeter data (denoted in the URL below with the "_1"), and pulling geojson data (per the suffix).
			//map.data.loadGeoJson("https://opendata.arcgis.com/datasets/d957997ccee7408287a963600a77f61f_1.geojson");
			map.data.loadGeoJson(`https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/1/query?where=CurrentDateAge+<%3D+7&outFields=*&f=geojson&ts=${Date.now()}`);

			// Color the wildfire areas as red...
			map.data.setStyle({ fillColor: 'red', strokeWeight: 1.0, strokeColor: 'salmon' });

			// Show an info window on click of fire area...
			fireInfoWindow = new google.maps.InfoWindow({
				content: ""
			});
			// Show wildfire info on either "click" or "mouseover" (refer to the 'showWildfireInfoEvent' variable set at the top of this script)...
			parent.fireInfoWindowListenerHandle = map.data.addListener(showWildfireInfoEvent, function(event) {
				// Show an infowindow on click...
				let comments = event.feature.getProperty("Comments");
				if (comments == null) {
					comments = "(comments not available)";
				};
				let acres = event.feature.getProperty("GISAcres");
				if (acres == null) {
					acres = "(not available)";
				} else {
					acres = Number(acres).toLocaleString('en-US', numFormatOptions)
				};
				let fireCategory = event.feature.getProperty("FeatureCategory");
				if (fireCategory == null) {
					fireCategory = "(not available)";
				};
				fireInfoWindow.setContent('<div style="line-height:1.35;overflow:hidden;white-space:nowrap;color:black;"><span style="font-weight:700;">Wildfire &quot;'+ event.feature.getProperty("IncidentName") + '&quot;</span><br/>' + comments + '<br/><br/>Calculated Acres: ' + acres + '<br/>Category: ' + fireCategory + '<br/>Days Since Last GIS Update: ' + event.feature.getProperty("CurrentDateAge") + '<br/>GIS Map Method: ' + event.feature.getProperty("MapMethod") + '</div>');
				let anchor = new google.maps.MVCObject();
				anchor.set("position",event.latLng);
				fireInfoWindow.open(map, anchor);
			});
			if (showWildfireInfoEvent == "mouseover") {
				parent.fireInfoWindowListenerHandle = map.data.addListener('mouseout', function(event) {
					fireInfoWindow.close();
				});
			};
		// Look to see if we should add power outages to the map...
		} else if (optionalMapType == "us-poweroutages") {
			const maxPerPage = 1000;
			const baseUrl = "https://services8.arcgis.com/S9R3NgKp66dTIzOU/ArcGIS/rest/services/DEMO_US_Power_Outages/FeatureServer/0/query";

			try {
				// First, get the total count of counties
				const countResponse = await fetch(`${baseUrl}?where=0%3D0&cacheHint=true&outFields=*&returnCountOnly=true&f=pjson&ts=${Date.now()}`);
				if (!countResponse.ok) {
					throw new Error(`Power outages count API error: ${countResponse.status} ${countResponse.statusText}`);
				}
				countyAPIData = await countResponse.json();
				const countyCount = parseInt(countyAPIData.count);
				const pageCount = Math.ceil(countyCount / maxPerPage);

				// Build an array of fetch promises for all pages (parallel fetching is much faster)
				const pagePromises = [];
				for (let currentPage = 0; currentPage <= pageCount; currentPage++) {
					const offset = currentPage * maxPerPage;
					const pageUrl = `${baseUrl}?where=0%3D0&outFields=*&cacheHint=true&resultOffset=${offset}&resultRecordCount=${maxPerPage}&f=pgeojson&ts=${Date.now()}`;
					pagePromises.push(
						fetch(pageUrl).then(response => {
							if (!response.ok) {
								throw new Error(`Power outages page ${currentPage} error: ${response.status}`);
							}
							return response.json();
						})
					);
				}

				// Wait for all pages to load in parallel...
				const pageResults = await Promise.all(pagePromises);

				// Combine all features from all pages...
				const countyFeatures = pageResults.flatMap(result => result.features || []);
				console.debug("US power outages loading complete - " + countyFeatures.length + " counties loaded");

				// Reset any lingering map popups, highlights, etc...
				map.data.forEach(function(feature) {
					map.data.remove(feature);
				});
				if (typeof parent.outageInfoWindowListenerHandle == "object") {
					google.maps.event.removeListener(parent.outageInfoWindowListenerHandle);
				}
				if (typeof parent.fireInfoWindowListenerHandle == "object") {
					google.maps.event.removeListener(parent.fireInfoWindowListenerHandle);
				}
				if (typeof parent.quakeInfoWindowListenerHandle == "object") {
					google.maps.event.removeListener(parent.quakeInfoWindowListenerHandle);
				}

				const geoJSON = {
					"type": "FeatureCollection",
					"properties": {
						"exceededTransferLimit": true
					},
					"features": countyFeatures
				};

				map.data.addGeoJson(geoJSON);

				// Color the county borders...
				// Dynamically fill the county based on how many customers are currently without power...
				map.data.setStyle(function(feature) {
					let percentAffected = 0;
					let strokeColor = "salmon";
					let strokeOpacity = 0.1;
					if (feature.getProperty('TrackedCount') > 0) {
						// Calculate what percentage of power customers are affected by outages...
						percentAffected = feature.getProperty('OutageCount') / feature.getProperty('TrackedCount');
					}

					// if (mapStyle == "night" || mapStyle == "dark") {
					// 	strokeColor = "cornflowerblue";
					// }
					return {
						fillColor: 'red',
						fillOpacity: percentAffected,
						strokeWeight: 1.0,
						strokeColor: strokeColor,
						strokeOpacity: strokeOpacity
					};
				});

				// Show county names on click...
				const outageInfoWindow = new google.maps.InfoWindow({
					content: ""
				});
				parent.outageInfoWindowListenerHandle = map.data.addListener('click', function(event) {
					// Show an infowindow on click...
					const timestamp = new Date(event.feature.getProperty("LastUpdate"));
					let percentAffected = 0;
					if (event.feature.getProperty('TrackedCount') > 0) {
						// Calculate what percentage of power customers are affected by outages...
						percentAffected = event.feature.getProperty('OutageCount') / event.feature.getProperty('TrackedCount') * 100;
					}

					// Calculate donut chart values (circumference = 2 * π * 35 ≈ 219.91)...
					const circumference = 219.91;
					const filledAmount = (percentAffected / 100) * circumference;
					const donutChart = `
						<svg width="100" height="100" viewBox="0 0 100 100" style="display:block;margin:10px auto;">
							<circle cx="50" cy="50" r="35" fill="none" stroke="#e0e0e0" stroke-width="12"/>
							<circle cx="50" cy="50" r="35" fill="none" stroke="#dc3545" stroke-width="12"
								stroke-dasharray="${filledAmount} ${circumference - filledAmount}"
								stroke-linecap="round"
								transform="rotate(-90 50 50)"/>
							<text x="50" y="50" text-anchor="middle" dominant-baseline="middle"
								font-size="18" font-weight="bold" fill="#333">${Math.round(percentAffected)}%</text>
						</svg>
					`;
					// Set the content of the info window...
					outageInfoWindow.setContent('<div style="line-height:1.5;overflow:hidden;white-space:nowrap;color:#333;"><h3 style="margin:0;">'+ event.feature.getProperty("NAME") + ' County Power Outages</h3>' + donutChart + '<p style="padding:5px 0;">Power Customers Affected: <strong>' + Math.round(percentAffected) + '%</strong> (' + event.feature.getProperty("OutageCount").toLocaleString() + ' of ' + event.feature.getProperty("TrackedCount").toLocaleString() + ')</p><p>Last Updated: ' + timestamp.toLocaleString() + '</p></div>');
					const anchor = new google.maps.MVCObject();
					anchor.set("position", event.latLng);
					outageInfoWindow.open(map, anchor);
				});

				// Highlight counties on mouseover...
				map.data.addListener('mouseover', function(event) {
					map.data.revertStyle();
					map.data.overrideStyle(event.feature, {strokeWeight: 3, strokeOpacity: 0.5});
				});
				map.data.addListener('mouseout', function(event) {
					map.data.revertStyle();
				});

			} catch (error) {
				console.error("Failed to fetch power outage data:", error);
			}

		} else if (optionalMapType == "earthquakes") {
			// Clear any previous load of the quake data...
			map.data.forEach(function(feature) {
				map.data.remove(feature);
			});
			if (typeof parent.fireInfoWindowListenerHandle == "object") {
				google.maps.event.removeListener(parent.fireInfoWindowListenerHandle);
			};
			if (typeof parent.outageInfoWindowListenerHandle == "object") {
				google.maps.event.removeListener(parent.outageInfoWindowListenerHandle);
			};
			if (typeof parent.quakeInfoWindowListenerHandle == "object") {
				google.maps.event.removeListener(parent.quakeInfoWindowListenerHandle);
			};

			// Load the earthquake data for the past day from the USGS site...
			// More info about this source of earthquake data can be found at: https://publicapis.io/usgs-earthquake-hazards-program-api
			if (quakeMode == "time") {
				await map.data.loadGeoJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson?ts=${Date.now()}`);
			} else {
				await map.data.loadGeoJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson?ts=${Date.now()}`);
			};
			// Other options for different timeframes and magnitudes...
			// map.data.loadGeoJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson");
			// await map.data.loadGeoJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
			// await map.data.loadGeoJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson");
			// await map.data.loadGeoJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson");
			// await map.data.loadGeoJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson");
			console.debug("Earthquake data loaded");

			// Style the earthquake markers...
			// map.data.setStyle({ fillColor: 'red', strokeWeight: 1.0, strokeColor: 'salmon', icon: {url: quakeIcon, scaledSize: { width: 40, height: 40}, anchor: { x: 20, y: 20 } } });
			map.data.setStyle(function(feature) {
				let alertColor = "crimson";
				let iconOpacity = 1.0;
				// Set our minimum opacity...
				iconOpacity = 0.5;

				// Leaving logic here commented out for color-coding the icons based on PAGER alert color...
				// alertColor = "gray";
				// if (feature.getProperty('alert') != null) {
				// 	alertColor = feature.getProperty('alert');
				// 	if (alertColor == "green") {
				// 		alertColor = "limegreen";
				// 	} else if (alertColor == "yellow") {
				// 		alertColor = "rgb(209 209 43)";
				// 	};
				// };

				if (quakeMode == "time") {
					// Leaving logic here commented out for changing the icon's opacity based on recency...
					// Calculate the icon's opacity based on how recent the quake occurred (newer = more opaque)...
					let now = new Date();
					let quakeTime = new Date(feature.getProperty('time'));
					// Calculate seconds since the quake occurred...
					let timeDiff = now - quakeTime;
					// Calculate a scale based on seconds in a day...
					let timeScale = (86400 * 12) / timeDiff * 100;
					// Change icon opacity based on age of the event...
					if (timeScale > iconOpacity) {
						iconOpacity = timeScale;
					};
				} else {
					let mag = feature.getProperty("mag");
					// We'll use magnitude 7 as a the top of our scale (i.e. mag 7 will be full opacity, with lesser being more faded)...
					let magScale = 1 - ((7 - mag) / 10);
					if (magScale > 0.5) {
						iconOpacity = magScale;
					}
				};
				// console.debug(`Opacity of ${feature.getProperty("place")} (mag ${feature.getProperty("mag")}): ${iconOpacity}`);

				return {
					icon: {url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' data-tooltip='Earthquake' viewBox='0 0 302.836 302.836'%3E%3Cpath d='M271 256a15 15 0 0 1-15 15 15 15 0 0 1-15-15 15 15 0 0 1 15-15 15 15 0 0 1 15 15z' style='opacity:${iconOpacity};fill:${alertColor};fill-opacity:${iconOpacity};stroke:none;stroke-width:8;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1' transform='translate(-104.582 -104.582)'/%3E%3Cpath d='M256 139.29c-64.44 0-116.71 52.27-116.71 116.71S191.56 372.71 256 372.71 372.71 320.44 372.71 256 320.44 139.29 256 139.29zm0 3c62.818 0 113.71 50.892 113.71 113.71 0 62.818-50.892 113.71-113.71 113.71-62.818 0-113.71-50.892-113.71-113.71 0-62.818 50.892-113.71 113.71-113.71z' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;direction:ltr;block-progression:tb;writing-mode:lr-tb;baseline-shift:baseline;text-anchor:start;white-space:normal;clip-rule:nonzero;display:inline;overflow:visible;visibility:visible;opacity:${iconOpacity};isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:${iconOpacity};fill:${alertColor};fill-opacity:.55474453;fill-rule:nonzero;stroke:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:${iconOpacity};color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto;enable-background:accumulate' transform='translate(-104.582 -104.582)'/%3E%3Cpath d='M256 214.266c-22.996 0-41.734 18.738-41.734 41.734 0 22.996 18.738 41.734 41.734 41.734 22.996 0 41.734-18.738 41.734-41.734 0-22.996-18.738-41.734-41.734-41.734zm0 9c18.132 0 32.734 14.602 32.734 32.734S274.132 288.734 256 288.734 223.266 274.132 223.266 256s14.602-32.734 32.734-32.734z' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;direction:ltr;block-progression:tb;writing-mode:lr-tb;baseline-shift:baseline;text-anchor:start;white-space:normal;clip-rule:nonzero;display:inline;overflow:visible;visibility:visible;opacity:${iconOpacity};isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:${iconOpacity};fill:${alertColor};fill-opacity:${iconOpacity};fill-rule:nonzero;stroke:${alertColor};stroke-width:3;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:${iconOpacity};color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto;enable-background:accumulate' transform='translate(-104.582 -104.582)'/%3E%3Cpath d='M256 189.678c-36.594 0-66.322 29.728-66.322 66.322s29.728 66.322 66.322 66.322 66.322-29.728 66.322-66.322-29.728-66.322-66.322-66.322zm0 6c33.35 0 60.322 26.971 60.322 60.322 0 33.35-26.971 60.322-60.322 60.322-33.35 0-60.322-26.971-60.322-60.322 0-33.35 26.971-60.322 60.322-60.322z' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;direction:ltr;block-progression:tb;writing-mode:lr-tb;baseline-shift:baseline;text-anchor:start;white-space:normal;clip-rule:nonzero;display:inline;overflow:visible;visibility:visible;opacity:${iconOpacity};isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:${iconOpacity};fill:${alertColor};fill-opacity:${iconOpacity};fill-rule:nonzero;stroke:none;stroke-width:6;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:${iconOpacity};color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto;enable-background:accumulate' transform='translate(-104.582 -104.582)'/%3E%3Cpath d='M256 166.164c-49.591 0-89.836 40.245-89.836 89.836S206.41 345.836 256 345.836 345.836 305.59 345.836 256 305.59 166.164 256 166.164zm0 4c47.43 0 85.836 38.406 85.836 85.836S303.43 341.836 256 341.836 170.164 303.43 170.164 256 208.57 170.164 256 170.164z' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;direction:ltr;block-progression:tb;writing-mode:lr-tb;baseline-shift:baseline;text-anchor:start;white-space:normal;clip-rule:nonzero;display:inline;overflow:visible;visibility:visible;opacity:${iconOpacity};isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:${iconOpacity};fill:${alertColor};fill-opacity:${iconOpacity};fill-rule:nonzero;stroke:none;stroke-width:4;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:${iconOpacity};color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto;enable-background:accumulate' transform='translate(-104.582 -104.582)'/%3E%3Cpath d='M256 109.582c-80.853 0-146.418 65.565-146.418 146.418 0 80.853 65.565 146.418 146.418 146.418 80.853 0 146.418-65.565 146.418-146.418 0-80.853-65.565-146.418-146.418-146.418zm0 2c79.772 0 144.418 64.646 144.418 144.418S335.772 400.418 256 400.418 111.582 335.772 111.582 256 176.228 111.582 256 111.582z' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;direction:ltr;block-progression:tb;writing-mode:lr-tb;baseline-shift:baseline;text-anchor:start;white-space:normal;clip-rule:nonzero;display:inline;overflow:visible;visibility:visible;opacity:${iconOpacity};isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:${iconOpacity};fill:${alertColor};fill-opacity:.35766422;fill-rule:nonzero;stroke:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:${iconOpacity};color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto;enable-background:accumulate' transform='translate(-104.582 -104.582)'/%3E%3C/svg%3E`, scaledSize: { width: 40, height: 40}, anchor: { x: 20, y: 20 } },
				}
			});

			// Show an info window on click of fire area...
			quakeInfoWindow = new google.maps.InfoWindow({
				content: ""
			});
			// Show wildfire info on either "click" or "mouseover" (refer to the 'showWildfireInfoEvent' variable set at the top of this script)...
			parent.quakeInfoWindowListenerHandle = map.data.addListener('click', function(event) {
				const content = document.createElement("div");
				// Show an infowindow on click...
				let quakeTime = new Date(event.feature.getProperty("time"));
				let updated = new Date(event.feature.getProperty("updated"));
				let title = "Earthquake Magnitude " + event.feature.getProperty("mag");
				let alertLabel = "(not available)";
				// let alertLabelColor = "inherit";
				let alertLabelColor = "white";
				if (event.feature.getProperty("alert") != null) {
					alertLabelColor = event.feature.getProperty("alert");
					alertLabel = event.feature.getProperty("alert").toUpperCase();
					if (alertLabelColor == "green") {
						alertLabelColor = "lawngreen";
					};
				};
				let quakeAgeInDays = (new Date() - quakeTime) / (86400 * 1000);

				quakeInfoWindow.setContent(`
					<div style="line-height:1.35;overflow:hidden;white-space:nowrap;color:black;">
						<div style="font-size: 1.2em;">
							<div style="font-weight:700;">Earthquake Magnitude ${event.feature.getProperty("mag")}</div>
							${event.feature.getProperty("place")}
						</div>
						<div style="text-align: center; margin: 10px 0;">
							<svg width="160" height="90" viewBox="0 0 160 90">
								<!-- Gradient definition -->
								<defs>
									<linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
										<stop offset="0%" style="stop-color:#4CAF50"/>
										<stop offset="37.5%" style="stop-color:#FFEB3B"/>
										<stop offset="62.5%" style="stop-color:#FF9800"/>
										<stop offset="100%" style="stop-color:#F44336"/>
									</linearGradient>
								</defs>
								<!-- Colored arc with gradient -->
								<path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="url(#gaugeGradient)" stroke-width="12" stroke-linecap="round"/>
								<!-- Tick marks and labels -->
								<text x="20" y="88" font-size="10" fill="#333" text-anchor="middle">0</text>
								<text x="45" y="40" font-size="10" fill="#333" text-anchor="middle">2</text>
								<text x="80" y="27" font-size="10" fill="#333" text-anchor="middle">4</text>
								<text x="115" y="40" font-size="10" fill="#333" text-anchor="middle">6</text>
								<text x="140" y="88" font-size="10" fill="#333" text-anchor="middle">8</text>
								<!-- Needle -->
								<line x1="80" y1="80" x2="${80 + 55 * Math.cos(Math.PI - (Math.PI * Math.min(8, Math.max(0, event.feature.getProperty("mag"))) / 8))}" y2="${80 - 55 * Math.sin(Math.PI - (Math.PI * Math.min(8, Math.max(0, event.feature.getProperty("mag"))) / 8))}" stroke="#333" stroke-width="3" stroke-linecap="round"/>
								<!-- Center circle -->
								<circle cx="80" cy="80" r="6" fill="#333"/>
								<!-- Magnitude value display -->
								<text x="80" y="70" font-size="14" font-weight="bold" fill="#333" text-anchor="middle">${event.feature.getProperty("mag").toFixed(1)}</text>
							</svg>
						</div>
						${event.feature.getProperty("tsunami") === 1 && quakeAgeInDays < 1 ? `
							<div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
								<?xml version='1.0' encoding='UTF-8' standalone='no'?>
								<svg width="35px" height="35px" viewBox="0 0 60.601004 60.601004" xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" version="1.1" xmlns="http://www.w3.org/2000/svg">
									<path d="m 57.316128,56.958628 c 1.125,0 2.225,-0.5825 2.825,-1.63125 0.6125,-1.04625 0.5625,-2.28875 0,-3.265 L 33.128628,5.2773777 c -0.5625,-0.97375 -1.6125,-1.635 -2.8375,-1.635 -1.2,0.0025 -2.25,0.66125 -2.8125,1.635 L 0.46612771,52.062378 c -0.575,0.97625 -0.6125,2.21875 -0.0125,3.265 0.61249999,1.04875 1.69999999,1.63125 2.83749999,1.63125 l 54.0250003,0" style="fill:#000000;fill-opacity:1;fill-rule:nonzero;stroke:none"/>
									<path d="m 30.291127,9.0848757 -13.85,23.9900003 c 14.9125,-7.8575 22.4375,-2.24875 24.7875,3.58875 l -0.4625,0.26625 c -0.3625,-0.3475 -0.775,-0.65625 -1.2375,-0.935 -3.1125,-1.86375 -6.9375,-1.21 -8.55,1.46625 -1.6125,2.685 -0.3875,6.37375 2.725,8.24125 6.1375,3.68625 13.975,2.81 18.725,1.71125 L 30.291127,9.0848757" style="fill:white;fill-opacity:1;fill-rule:evenodd;stroke:none"/>
								</svg>
								<span style="font-weight: bold; color: #333;">Tsunami risk</span>
							</div>
						` : ''}
						<div style="margin: 15px 0;">Current <a href="https://earthquake.usgs.gov/data/pager/onepager.php" target="_blank">USGS PAGER</a> Alert Level: <strong style="color: ${alertLabelColor}; background-color: black; padding: 5px; border-radius: 7px; font-size: 0.9em;">${alertLabel}</strong></div>
						<div style="font-size: 0.95em;">
							<span style="font-weight: 500;">Detected:</span> ${quakeTime.toLocaleString()} <span style="font-size: 0.95em;">(${quakeAgeInDays.toFixed(1)} days ago)</span><br/>
							<span style="font-weight: 500;">Updated:</span> ${updated.toLocaleString()}
						</div>
						<div style="margin: 15px 0 5px 0;">
							<a href="${event.feature.getProperty("url")}" target="_blank" style="background-color: dodgerblue; padding: 5px; border-radius: 5px; color: white; text-decoration: none; font-size: 1.15em; font-weight: 400; display: inline-flex; align-items: center; gap: 5px;">
								<svg xmlns="http://www.w3.org/2000/svg" width="22" viewBox="0 0 640 640"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z" fill="white"/></svg>
								Earthquake details
							</a>
						</div>
					</div>
				`);

				quakeInfoWindow.setPosition(event.latLng);
				quakeInfoWindow.open(map);
			});
			if (showWildfireInfoEvent == "mouseover") {
				parent.quakeInfoWindowListenerHandle = map.data.addListener('mouseout', function(event) {
					quakeInfoWindow.close();
				});
			};
		};
	};
};

// Function called when the "Reset Zoom" button is pressed...
function resetZoom() {
	// If there's only 1 marker, avoid zooming in super close (i.e. use the default zoom level 3)...
	if (markers.length > 0) {
		// Add padding to avoid markers appearing under the map's UI controls...
		map.fitBounds(bounds, {
			top: 70,
			right: 70,
			bottom: 70,
			left: 70
		});
	};
	// Reset the tilt & heading back to their original values...
	mapTilt = defaultMapTilt;
	mapHeading = defaultMapHeading;
	map.setTilt(mapTilt);
	map.setHeading(mapHeading);
};

// Function to capture presses of the Enter key in the 'Group Filter' field (without this the widget refreshes in an error)...
function groupkeyHandler(e) {
	// Get the keycode of which key was pressed...
	let key = e.keyCode || e.which;
	// If the key was the Enter/Return key...
	if (key == 13) {
		// Stop the form from submitting...
		e.preventDefault();
		// Refresh the group data...
		refreshGroupData();
	};
};

function toggleMiscOptions() {
	let areaElement = document.getElementById("optionsToggleArea");
	let gearIcon = document.getElementById("gearIcon");
	let gearIconChevron = document.getElementById("gearIconChevron");

	if (areaElement.style.display == "flex") {
		areaElement.style.display = "none";
		gearIcon.style.fill = "#aaa";
		gearIconChevron.style.display = "none";
	} else {
		areaElement.style.display = "flex";
		gearIcon.style.fill = "blue";
		// gearIcon.style.fill = "#555";
		gearIconChevron.style.display = "block";
	};
};

function waitForElm(selector) {
	return new Promise(resolve => {
		if (document.querySelector(selector)) {
			return resolve(document.querySelector(selector));
		};

		const observer = new MutationObserver(mutations => {
			if (document.querySelector(selector)) {
				observer.disconnect();
				resolve(document.querySelector(selector));
			}
		});

		// If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	});
};