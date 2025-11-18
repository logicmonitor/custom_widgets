# Custom Widgets
A collection of custom-scripted LogicMonitor dashboard widgets that have proven handy for various tasks.

---
## Widgets

### Better Map Widget
A fully custom-made widget to overcome some limitations of LogicMonitor's core Map widget. The ideas behind it are:

- Support for 1,000+ pins on the map to accommodate larger environments
- Marker clustering to group adjacent pins together until zoomed in (along with a button to easily reset the zoom)
- Donut charts to represent the severities of clustered markers
- Quick & easy filtering by past and severities
- Layers for weather, earthquakes, US wildfires, and US power outages
- More informative tips when clicking a marker, with the ability to include custom properties
- The ability to show colored lines representing status of connections between locations

#### Prerequisites

- Groups, resources, or services with valid addresses set in the usual 'location' property
- If you want to show connections between locations and their status, load the 'Set Better Map Widget Connections' PropertySource

#### Initial Configuration

1. Create a new Text widget on your dashboard.
2. On the Text widget's edit dialog, click the "Source" button, paste in the HTML source code for the script, then save the widget.
3. Add optional dashboard tokens to modify defaults for the widget as desired. A list of token options is provided below. These can also be hard-coded into the widget in a section at the top of the source code.

#### Usage

Clicking on a marker cluster will display more info about that group, including the option to zoom in to see the clustered markers. To quickly reset the zoom, just click the bottom button in the upper-left corner of the map (the one with the 4 arrows).

By default the map will auto-refresh every 2 minutes, though that's configurable by changing the 'statusUpdateIntervalMinutes' variable near the top of the script.

Note that by default the zoom level of the map will _not_ auto-reset on refreshes to ensure that all markers are visible. Enabling that feature can be very useful when filtering on specific severities and new matching items appear, especially when displayed on overhead monitors.

Visibility of the toolbar along the top of the widget can be toggled using the button in the upper-left corner of the map.

#### Optional Customization

Behavior of the widget can be customized using the following optional dashboard tokens.

- **MapSourceType**: Whether to map "groups", "resources", or "services". Default is "groups".
- **MapGroupPathFilter**: Allows setting a default group path to start. Default is "\*".
- **MapShowWeather**: If weather should be shown by default. Options are "global" or "nexrad". Default is "global".
- **MapOverlayOption**: Which optional overlay to default to when weather is shown. Options are "wildfires", "outages", or "earthquakes". Default is "wildfires".
- **HideMapOptions**: If "true" then will hide the options bar by default. Default is "false".
- **MapIgnoreCleared**: If "true" then will only show items currently alerting (useful for maps with thousands of markers). Default is "false".
- **MapIgnoreWarnings**: If "true" then won't show items in "Warning" status. Default is "false".
- **MapIgnoreErrors**: If "true" then won't show items in "Error" status. Default is "false".
- **MapIgnoreCriticals**: If "true" then won't show items in "Critical" status. Default is "false".
- **AutoResetMapOnRefresh**: If "true" then the map will automatically zoom to encompass all items on timed refreshes. Default is "false".
- **MapDisableClustering**: If "true" then clustering of adjacent markers on the map will be disabled. Might be desirable if showing connections between locations since clustering might hide markers at certain zoom levels. Default is "false".
- **MapDisplayProperties**: An optional comma-delimited list of custom properties to show when viewing a group's/resource's details.
- **MapStyle**: Allows one of the following available map style options: "silver", "standard", "dark", "aubergine", or "silverblue". Default is "silver".

#### Showing Connections between Locations

Better Map Widget allows a way to represent connectivity between locations. Currently this only supports alert status of instances of the "SNMP_Network_Interfaces" datasource and any datasource with "VPN" in the name.

To configure, go to the specific instance of one of those datasources and add an instance-level property called 'custom_map_connection'. The value should be in the following format:

{Connection Title} > {Hostname/IP of the connected resource}

For example: "London WAN > 192.168.1.10" would show a line titled "London WAN" representing this specific interface connected from that resource's location to the resource monitored as 192.168.1.10. A PropertySource - "Set Better Map Widget Connections" - automatically configures those instance-level properties as resource-level properties along with other necessary data for the widget to use.