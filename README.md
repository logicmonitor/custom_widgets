### A collection of useful custom-scripted LogicMonitor dashboard widgets.

**NOTE:** While this work is provided for use by the LogicMonitor community, they were created as personal projects and are *not* officially supported by LogicMonitor.

#### Widgets

- [Better Map Widget](#better-map-widget)
- [Dynamic Dashboard List](#dynamic-dashboard-list)
- [Dashboard Themer](#dashboard-themer)

---
# Better Map Widget

![Image](Sample%20Dashboards/Screenshots/Better_Map_Widget.png?raw=true)
[Download sample dashboard](Sample%20Dashboards/Better_Map_Widget.json) / [Widget source code](src/Better_Map_Widget-CDN.html)

A fully custom-made widget to overcome some limitations of LogicMonitor's core Map widget. The ideas behind it are:

- Support for 1,000+ pins on the map to accommodate larger environments
- Marker clustering to group adjacent pins together until zoomed in (along with a button to easily reset the zoom)
- Donut charts to represent the severities of clustered markers
- Quick & easy filtering by past and severities
- Layers for weather, earthquakes, US wildfires, and US power outages
- More informative tips when clicking a marker, with the ability to include custom properties
- The ability to show colored lines representing status of connections between locations

## "CDN" vs "Legacy" Versions

There are two different versions of the widget's source code:

- [Better_Map_Widget-CDN.html](src/Better_Map_Widget-CDN.html): *(recommended)* Contains just the HTML necessary to run and all the Javascript - which is what typically changes between versions - is loaded dynamically via CDN.
	- **Pros**: Requires far less manual updating - it's always up-to-date with what's published here.
	- **Cons**: Might not work in some circumstances if you need to embed it into a dashboard outside of LogicMonitor.
- [Better_Map_Widget-Full.html](src/Better_Map_Widget-Full.html): All the Javascript is directly embedded in the widget.
	- **Pros**: Will work in almost every circumstance if embedded into a webpage outside of your LogicMonitor.
	- **Cons**: Requires manual effort to keep it updated with the latest updates published here.

## Prerequisites

- Groups, resources, or services with valid addresses set in the usual 'location' property
- If you want to show connections between locations and their status, load the [Set Better Map Widget Connections](LogicModules/Set_Better_Map_Widget_Connections.json) PropertySource into your portal

## Initial Configuration

1. Create a new Text widget on your dashboard.
2. On the Text widget's edit dialog, click the "Source" button, paste in the HTML source code for the script, then save the widget.
3. Add optional dashboard tokens to modify defaults for the widget as desired. A list of token options is provided below. These can also be hard-coded into the widget in a section at the top of the source code.

## Usage

Clicking on a marker cluster will display more info about that group, including the option to zoom in to see the clustered markers. To quickly reset the zoom, just click the bottom button in the upper-left corner of the map (the one with the 4 arrows).

By default the map will auto-refresh every 2 minutes, though that's configurable by changing the 'statusUpdateIntervalMinutes' variable near the top of the script.

Note that by default the zoom level of the map will _not_ auto-reset on refreshes to ensure that all markers are visible. Enabling that feature can be very useful when filtering on specific severities and new matching items appear, especially when displayed on overhead monitors.

Visibility of the toolbar along the top of the widget can be toggled using the button in the upper-left corner of the map.

## Optional Customization

Behavior of the widget can be customized using the following optional dashboard tokens:

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

## Showing Connections between Locations

Better Map Widget allows a way to represent connectivity between locations. Currently this only supports alert status of instances of the "SNMP_Network_Interfaces" datasource and any datasource with "VPN" in the name.

To configure:
1. Be sure you've loaded the required PropertySource mentioned in the Prerequisites section above.
2. Go to the specific instance of one of either the 'SNMP_Network_Interfaces' datasource or a datasource with "VPN" in its name, and add an instance-level property called 'custom_map_connection'. The value should be in the following format: `{Connection Title} > {Hostname/IP of the connected resource}`

For example: `London WAN > 192.168.1.10` would show a line titled "London WAN" representing this specific interface connected from that resource's location to the resource monitored as 192.168.1.10. A PropertySource - "Set Better Map Widget Connections" - automatically configures those instance-level properties as resource-level properties along with other necessary data for the widget to use.

---
# Dynamic Dashboard List

![Image](Sample%20Dashboards/Screenshots/Dynamic_Dashboard_List.png?raw=true)
[Download sample dashboard](Sample%20Dashboards/Dynamic_Dashboard_List.json) / [Widget source code](src/Dashboard_Themer_Widget.html)

This script was created in response to a customer needing a quick way to drill-down from an overview dashboard to various specific dashboards. While straightforward to manually make a list in a text widget, we wanted a way to dynamically list dashboards as they were added or changed. To further enhance the functionality, if a 'defaultResourceGroup' token is set on a dashboard group then the script will fetch current alert status for that group (can be disabled via the 'fetchGroupAlertStatus' variable in the script if API limits are an issue).

To use this, just add a Text widget to your dashboard and in the widget's configuration screen click the "source" view then paste in this code. You can also just clone this widget to another dashboard on the same portal.

## Optional Customization

Behavior of the widget can be customized using the following optional dashboard tokens:

- **ShowFullDashboardPath**: Show the dashboard group's full path vs it's short name. Default: true.
- **defaultDashboardGroup**: (optional) The "parent" dashboard group you want to list dashboards under. If not set then the script will default to showing all dashboard groups.
- **DashboardsToExclude**: (optional) A regular expression to filter any dashboards you DON'T want listed. Example: .\*[Tt]+emplate.\*

---
# Dashboard Themer

![Image](Sample%20Dashboards/Screenshots/Dashboard_Themer.gif?raw=true)
[Download sample dashboard](Sample%20Dashboards/Dashboard_Themer.json) / [Widget source code](src/Dynamic_Dashboard_List.html)

This one was created purely as a fun side project and may be rendered useless at any time by UI changes.

All it does is change a few of our basic CSS classes and let you dynamically choose a background color. When you save it stores your choice in a dashboard token called 'BackgroundColor', or as a browser cookie for your own personal preference. It also has logic to change the color of labels & icons so they stay readable based on brightness of the background.
