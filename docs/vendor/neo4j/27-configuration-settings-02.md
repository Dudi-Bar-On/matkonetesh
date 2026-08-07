---
name: 27-configuration-settings-02
description: "Neo4j 2026.06.0 — Configuration settings reference (2/6): connection, cypher settings (23/60, config)"
type: reference
---

<!-- source: https://github.com/neo4j/docs-operations/blob/2026.06.0/modules/ROOT/pages/configuration/configuration-settings.adoc -->
<!-- source (raw): https://raw.githubusercontent.com/neo4j/docs-operations/2026.06.0/modules/ROOT/pages/configuration/configuration-settings.adoc -->
<!-- repo: neo4j/docs-operations  ref: 2026.06.0 -->
<!-- retrieved: 2026-08-07 -->
<!-- fidelity: VERBATIM — fetched as raw AsciiDoc from GitHub, unmodified except for this header (split from the single upstream page for retrieval granularity). -->

[[configuration-settings]]
= Configuration settings
:description: This page provides a reference to the Neo4j configuration settings.
:page-styles: hide-table-captions

The Neo4j configuration settings are set in xref::/configuration/file-locations.adoc[_neo4j.conf_].
Refer to xref:configuration/neo4j-conf.adoc#_configuration_settings[The neo4j.conf file] for details on how to use configuration settings.

For lists of changed, deprecated, or removed configuration settings in the 2025-2026 series, refer to xref:changes-2025-2026.adoc[Changes in Neo4j 2025-2026 series], xref:deprecations.adoc[Current deprecations], and xref:breaking-changes.adoc[Breaking changes in Neo4j 2025.01].

To list all available configuration settings on a Neo4j server, run the link:{neo4j-docs-base-uri}/cypher-manual/current/clauses/listing-settings[`SHOW SETTINGS`] command.



== Connection settings

Connection settings control the communication between servers and between a server and a client.
Neo4j provides support for Bolt, HTTP, and HTTPS protocols via connectors.
For more information about the connectors, see xref:configuration/connectors.adoc[Configure network connectors].

When configuring the HTTPS or xref:/performance/bolt-thread-pool-configuration.adoc[Bolt], see also  <<_security_settings>> and xref:security/ssl-framework.adoc[SSL framework] for details on how to work with SSL certificates.


[[config_server.bolt.advertised_address]]
=== `server.bolt.advertised_address`

.server.bolt.advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Advertised address for this connector.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port` that is an accessible address. If missing, it is acquired from `server.default_advertised_address`.
|Default value
m|+++:7687+++
|===


[[config_server.bolt.connection_keep_alive]]
=== `server.bolt.connection_keep_alive`

.server.bolt.connection_keep_alive
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum time to wait before sending a NOOP on connections waiting for responses from active ongoing queries.The minimum value is 1 millisecond.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`) that is minimum `1ms`.
|Default value
m|+++1m+++
|===


[[config_server.bolt.connection_keep_alive_for_requests]]
=== `server.bolt.connection_keep_alive_for_requests`

.server.bolt.connection_keep_alive_for_requests
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The type of messages to enable keep-alive messages for `ALL`, `STREAMING`, or `OFF`.
|Valid values
a|One of [ALL, STREAMING, OFF].
|Default value
m|+++ALL+++
|===


[[config_server.bolt.connection_keep_alive_probes]]
=== `server.bolt.connection_keep_alive_probes`

.server.bolt.connection_keep_alive_probes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The total number of probes to be missed before a connection is considered stale. The minimum value is 1.
|Valid values
a|An integer that is minimum `1`.
|Default value
m|+++2+++
|===


[[config_server.bolt.connection_keep_alive_streaming_scheduling_interval]]
=== `server.bolt.connection_keep_alive_streaming_scheduling_interval`

.server.bolt.connection_keep_alive_streaming_scheduling_interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The interval between every scheduled keep-alive check on all connections with active queries. Zero duration turns off keep-alive service.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`) that is minimum `0s`.
|Default value
m|+++1m+++
|===


[[config_server.bolt.enabled]]
=== `server.bolt.enabled`

.server.bolt.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable the Bolt connector.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_server.bolt.listen_address]]
=== `server.bolt.listen_address`

.server.bolt.listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Address the connector should bind to.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from server.default_listen_address.
|Default value
m|+++:7687+++
|===


[[config_server.bolt.additional_listen_addresses]]
=== `server.bolt.additional_listen_addresses`

.server.bolt.additional_listen_addresses
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Additional addresses the connector should bind to.
|Valid values
a|A comma-separated set where each element is a socket address in the format of `hostname:port`, `hostname`, or `:port`.
|Default value
m|
|===

[[config_server.bolt.ocsp_stapling_enabled]]
=== `server.bolt.ocsp_stapling_enabled`

.server.bolt.ocsp_stapling_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable server OCSP stapling for bolt and http connectors.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===



[[config_server.bolt.telemetry.enabled]]
=== `server.bolt.telemetry.enabled`

.server.bolt.telemetry.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable the collection of driver telemetry.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_server.bolt.enable_network_error_accounting]]
=== `server.bolt.enable_network_error_accounting`

.server.bolt.enable_network_error_accounting
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enables accounting-based reporting of benign errors within the Bolt stack. When enabled, benign errors are reported only when such events occur with unusual frequency.
When disabled, all benign network errors are reported.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_server.bolt.network_abort_clear_window_duration]]
=== `server.bolt.network_abort_clear_window_duration`

.server.bolt.network_abort_clear_window_duration
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The duration for which network-related connection aborts need to remain at a reasonable level before the error is cleared.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s) that is minimum `1s`.
|Default value
m|+++10m+++
|===


[[config_server.bolt.network_abort_warn_threshold]]
=== `server.bolt.network_abort_warn_threshold`

.server.bolt.network_abort_warn_threshold
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of network-related connection aborts allowed within a specified time window before emitting log messages. A value of zero reverts to legacy warning behavior.
|Valid values
a|A long that is minimum `0`.
|Default value
m|+++2+++
|===


[[config_server.bolt.network_abort_warn_window_duration]]
=== `server.bolt.network_abort_warn_window_duration`

.server.bolt.network_abort_warn_window_duration
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The duration of the window in which network-related connection aborts are sampled.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s) that is minimum `1s`.
|Default value
m|+++10m+++
|===


[[config_server.bolt.thread_pool_keep_alive]]
=== `server.bolt.thread_pool_keep_alive`

.server.bolt.thread_pool_keep_alive
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum time an idle thread in the thread pool bound to this connector waits for new tasks.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++5m+++
|===


[[config_server.bolt.thread_pool_max_size]]
=== `server.bolt.thread_pool_max_size`

.server.bolt.thread_pool_max_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of threads allowed in the thread pool bound to this connector.
|Valid values
a|An integer.
|Default value
m|+++400+++
|===


[[config_server.bolt.thread_pool_min_size]]
=== `server.bolt.thread_pool_min_size`

.server.bolt.thread_pool_min_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The number of threads, including idle, to keep in the thread pool bound to this connector.
|Valid values
a|An integer.
|Default value
m|+++5+++
|===


[[config_server.bolt.thread_starvation_clear_window_duration]]
=== `server.bolt.thread_starvation_clear_window_duration`

.server.bolt.thread_starvation_clear_window_duration
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The duration for which unscheduled requests need to remain at a reasonable level before the error is cleared.
|Valid values
a| A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s) that is minimum `1s`.
|Default value
m|+++10m+++
|===


[[config_server.bolt.thread_starvation_warn_threshold]]
=== `server.bolt.thread_starvation_warn_threshold`

.server.bolt.thread_starvation_warn_threshold
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of unscheduled requests allowed during thread starvation events within a specified time window before emitting log messages.
|Valid values
a|A long that is minimum `0`.
|Default value
m|+++2+++
|===


[[config_server.bolt.thread_starvation_warn_window_duration]]
=== `server.bolt.thread_starvation_warn_window_duration`

.server.bolt.thread_starvation_warn_window_duration
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The duration of the window in which unscheduled requests are sampled.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s) that is minimum `1s`.
|Default value
m|+++10m+++
|===

[[config_server.bolt.tls_level]]
=== `server.bolt.tls_level`

.server.bolt.tls_level
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The encryption level to be used to secure communications with this connector.
|Valid values
a|One of [REQUIRED, OPTIONAL, DISABLED].
|Default value
m|+++DISABLED+++
|===


[[config_server.bolt.traffic_accounting_check_period]]
=== `server.bolt.traffic_accounting_check_period`

.server.bolt.traffic_accounting_check_period
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Amount of time spent between samples of current traffic usage. Lower values result in more accurate reporting while incurring a higher performance penalty. A value of zero disables traffic accounting.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s) that is 0s or is minimum `1m`.
|Default value
m|+++5m+++
|===


[[config_server.bolt.traffic_accounting_clear_duration]]
=== `server.bolt.traffic_accounting_clear_duration`

.server.bolt.traffic_accounting_clear_duration
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Time to be spent below the configured traffic threshold to clear traffic warnings.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s) that is minimum `1m`.
|Default value
m|+++10m+++
|===


[[server.bolt.traffic_accounting_incoming_threshold_mbps]]
=== `server.bolt.traffic_accounting_incoming_threshold_mbps`

.server.bolt.traffic_accounting_incoming_threshold_mbps
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum permitted incoming traffic within a configured accounting check window before emitting a warning (in Mbps).
|Valid values
a|A long that is minimum `1`.
|Default value
m|+++950+++
|===


[[server.bolt.traffic_accounting_outgoing_threshold_mbps]]
=== `server.bolt.traffic_accounting_outgoing_threshold_mbps`

.server.bolt.traffic_accounting_outgoing_threshold_mbps
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum permitted outgoing traffic within a configured accounting check window before emitting a warning (in Mbps).
|Valid values
a|A long that is minimum `1`.
|Default value
m|+++950+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_auth]]
=== `server.bolt.unix_socket_auth`

.server.bolt.unix_socket_auth
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable or disable authentication via the Bolt Unix Domain Socket connector. If disabled, connected clients gain all permissions so long as they are able to access the Unix Domain Socket file.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_delete]]
=== `server.bolt.unix_socket_delete`

.server.bolt.unix_socket_delete
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Whether or not to delete an existing file for use with the Unix Domain Socket based interface. This improves the handling of the case where a previous hard shutdown was unable to delete the file.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_enabled]]
=== `server.bolt.unix_socket_enabled`

.server.bolt.unix_socket_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable or disable the Bolt Unix Domain Socket connector.Requests submitted via this connector will be placed within a dedicated thread pool which is isolated from all other Bolt connections.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_path]]
=== `server.bolt.unix_socket_path`

.server.bolt.unix_socket_path
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The absolute path of the file for use with the Unix Domain Socket interface. This file must be specified and will be created at runtime and deleted on shutdown.
|Valid values
a|A path.
|Default value
m|++++++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_permission_mask]]
=== `server.bolt.unix_socket_permission_mask`

.server.bolt.unix_socket_permission_mask
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Sets the default permission mask applied to the Unix Domain Socket file. This mask should be set as restrictive as possible (especially when authentication is disabled on this connector).Note, however, that this permission may not be honored by Posix systems other than Linux.
|Valid values
a|A set of file permissions.
|Default value
m|+++rwx--x--x+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_thread_pool_keep_alive]]
=== `server.bolt.unix_socket_thread_pool_keep_alive`

.server.bolt.unix_socket_thread_pool_keep_alive
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum time an idle thread in the thread pool bound to the Unix Domain Socket connector waits for new tasks.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s).
|Default value
m|+++5m+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_thread_pool_max_size]]
=== `server.bolt.unix_socket_thread_pool_max_size`

.server.bolt.unix_socket_thread_pool_max_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of threads allowed in the thread pool bound to the Unix Domain Socket connector.
|Valid values
a|An integer that is minimum 1.
|Default value
m|+++20+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_thread_pool_min_size]]
=== `server.bolt.unix_socket_thread_pool_min_size`

.server.bolt.unix_socket_thread_pool_min_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The number of threads, including idle, to keep in the thread pool bound to the Unix Domain Socket connector.
|Valid values
a|An integer that is minimum 0.
|Default value
m|+++0+++
|===

[role=label--new-2025.08]
[[config_server.bolt.unix_socket_use_dedicated_thread_pool]]
=== `server.bolt.unix_socket_use_dedicated_thread_pool`

.server.bolt.unix_socket_use_dedicated_thread_pool
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Whether or not to allocate a dedicated thread pool for use with the Unix Domain Socket based interface. This permits the use of the Unix Domain Socket connector as an emergency access connector when the server is over capacity.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===

[[config_server.http.advertised_address]]
=== `server.http.advertised_address`

.server.http.advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Advertised address for this connector.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port` that is an accessible address. If missing, it is acquired from server.default_advertised_address.
|Default value
m|+++:7474+++
|===


[[config_server.http.enabled]]
=== `server.http.enabled`

.server.http.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable the HTTP connector.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_server.http.listen_address]]
=== `server.http.listen_address`

.server.http.listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Address the connector should bind to.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from server.default_listen_address.
|Default value
m|+++:7474+++
|===


[role=label--new-2026.03]
[[config_server.http.x_forward.enabled]]
=== `server.http.x_forward.enabled`

.server.http.x_forward.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable processing of X-Forwarded-Host and X-Forwarded-Proto headers. Only enable this if Neo4j is behind a trusted reverse proxy or load balancer. When disabled, X-Forward headers are ignored for security reasons.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--new-2026.03]
[[config_server.http.x_forward.allow_hosts]]
=== `server.http.x_forward.allow_hosts`

.server.http.x_forward.allow_hosts
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|List of allowed hostnames that can appear in X-Forwarded-Host header. This prevents host header injection attacks. Leave empty to accept any hostname (not recommended for production).
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|++++++
|===


[role=label--new-2026.03]
[[config_server.http.x_forward.allow_proxies]]
=== `server.http.x_forward.allow_proxies`

.server.http.x_forward.allow_proxies
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|List of trusted proxy IP addresses allowed to set X-Forward headers. Only requests from these IPs will have their X-Forward headers processed. Leave empty to accept X-Forward headers from any source (not recommended).
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|++++++
|===


[role=label--new-2026.03]
[[config_server.http.x_forward.private_ips_enabled]]
=== `server.http.x_forward.private_ips_enabled`

.server.http.x_forward.private_ips_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Allow private IP addresses (RFC 1918) in X-Forwarded-Host header. Set to false to prevent internal network reconnaissance attacks.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_server.http_enabled_modules]]
=== `server.http_enabled_modules`

.server.http_enabled_modules
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Defines the set of modules loaded into the Neo4j web server. The enterprise management endpoints are only available in the Еnterprise edition.
|Valid values
a|A comma-separated set where each element is one of [TRANSACTIONAL_ENDPOINTS, UNMANAGED_EXTENSIONS, BROWSER, ENTERPRISE_MANAGEMENT_ENDPOINTS, QUERY_API_ENDPOINTS].
|Default value
m|+++TRANSACTIONAL_ENDPOINTS,UNMANAGED_EXTENSIONS,BROWSER,ENTERPRISE_MANAGEMENT_ENDPOINTS,QUERY_API_ENDPOINTS+++
|===



[[config_server.http_enabled_transports]]
=== `server.http_enabled_transports`

.server.http_enabled_transports
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Defines the set of transports available on the HTTP server.
|Valid values
a|A comma-separated set where each element is one of [HTTP1_1, HTTP2].
|Default value
m|+++HTTP1_1,HTTP2+++
|===


[[config_server.https.advertised_address]]
=== `server.https.advertised_address`

.server.https.advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Advertised address for this connector.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port` that is an accessible address. If missing, it is acquired from server.default_advertised_address.
|Default value
m|+++:7473+++
|===


[[config_server.https.enabled]]
=== `server.https.enabled`

.server.https.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable the HTTPS connector.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_server.https.listen_address]]
=== `server.https.listen_address`

.server.https.listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Address the connector should bind to.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from server.default_listen_address.
|Default value
m|+++:7473+++
|===


[[config_server.default_advertised_address]]
=== `server.default_advertised_address`

.server.default_advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Default hostname or IP address the server uses to advertise itself.
|Valid values
a|A hostname that has no specified port and is an accessible address.
|Default value
m|+++localhost+++
|===


[[config_server.default_listen_address]]
=== `server.default_listen_address`

.server.default_listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Default network interface to listen for incoming connections. To listen for connections on all interfaces, use "0.0.0.0".
|Valid values
a|A hostname that has no specified port.
|Default value
m|+++localhost+++
|===


[role=label--enterprise-edition]
[[config_server.routing.advertised_address]]
=== `server.routing.advertised_address`

.server.routing.advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The advertised address for the intra-cluster routing connector.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port` that is an accessible address. If missing, it is acquired from `server.default_advertised_address`.
|Default value
m|+++:7688+++
|===


[[config_server.routing.listen_address]]
=== `server.routing.listen_address`

.server.routing.listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Address routing connector should bind to.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from server.default_listen_address.
|Default value
m|+++:7688+++
|===


[role=label--dynamic]
[[config_dbms.routing.client_side.enforce_for_domains]]
=== `dbms.routing.client_side.enforce_for_domains`

.dbms.routing.client_side.enforce_for_domains
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Always use client-side routing (regardless of the default router) for `neo4j://` protocol connections to these domains. A comma-separated list of domains. Wildcards (`*`) are supported.
|Valid values
a|A comma-separated set where each element is a string.
|Default value
m|++++++
|===


[[config_dbms.routing.default_router]]
=== `dbms.routing.default_router`

.dbms.routing.default_router
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Routing strategy for `neo4j://` protocol connections.
Default is `CLIENT`, using client-side routing, with server-side routing as a fallback (if enabled).
When set to `SERVER`, client-side routing is short-circuited, and requests rely on server-side routing, which must be enabled for proper operation using <<config_dbms.routing.enabled,`dbms.routing.enabled`>>=`true`.
Can be overridden by <<config_dbms.routing.client_side.enforce_for_domains,`dbms.routing.client_side.enforce_for_domains`>>.
|Valid values
a|One of [SERVER, CLIENT].
|Default value
m|+++CLIENT+++
|===


[[config_dbms.routing.driver.connection.connect_timeout]]
=== `dbms.routing.driver.connection.connect_timeout`

.dbms.routing.driver.connection.connect_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Socket connection timeout.
A timeout of zero is treated as an infinite timeout and will be bound by the timeout configured on the
operating system level.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++5s+++
|===


[[config_dbms.routing.driver.connection.max_lifetime]]
=== `dbms.routing.driver.connection.max_lifetime`

.dbms.routing.driver.connection.max_lifetime
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Pooled connections older than this threshold will be closed and removed from the pool.
Setting this option to a low value will cause a high connection churn and might result in a performance hit.
It is recommended to set maximum lifetime to a slightly smaller value than the one configured in network
equipment (load balancer, proxy, firewall, etc. can also limit maximum connection lifetime).
Zero and negative values result in lifetime not being checked.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++1h+++
|===


[[config_dbms.routing.driver.connection.pool.acquisition_timeout]]
=== `dbms.routing.driver.connection.pool.acquisition_timeout`

.dbms.routing.driver.connection.pool.acquisition_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum amount of time spent attempting to acquire a connection from the connection pool.
This timeout only kicks in when all existing connections are being used, and no new connections can be created because the maximum connection pool size has been reached.
An error is raised when no connection can be acquired within the configured time.
Negative values are allowed, which results in an unlimited acquisition timeout. A value of 0 is allowed, resulting in no timeout and immediate failure when the connection is unavailable.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++1m+++
|===


[[config_dbms.routing.driver.connection.pool.idle_test]]
=== `dbms.routing.driver.connection.pool.idle_test`

.dbms.routing.driver.connection.pool.idle_test
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Pooled connections that have been idle in the pool for longer than this timeout will be tested to ensure they are still alive before being used again.
If the value of this option is too low, acquiring a connection will require an additional network call, which will cause a performance hit.
If the value of this option is too high, live connections might no longer be used, leading to errors.
Hence, this parameter balances the likelihood of experiencing connection problems and performance.
Usually, this parameter should not need tuning.
Value 0 means connections will always be tested for validity.
No connection liveliness check is done by default.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|
|===


[[config_dbms.routing.driver.connection.pool.max_size]]
=== `dbms.routing.driver.connection.pool.max_size`

.dbms.routing.driver.connection.pool.max_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum total number of connections to be managed by a connection pool.
The limit is enforced for a combination of a host and user. Negative values are allowed and result in unlimited pool. Value of 0 is not allowed. Defaults to `-1` (unlimited).
|Valid values
a|An integer.
|Default value
m|+++-1+++
|===


[[config_dbms.routing.driver.logging.level]]
=== `dbms.routing.driver.logging.level`

.dbms.routing.driver.logging.level
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Sets the level for the driver's internal logging.
|Valid values
a|One of [DEBUG, INFO, WARN, ERROR, NONE].
|Default value
m|+++INFO+++
|===


[[config_dbms.routing.enabled]]
=== `dbms.routing.enabled`

.dbms.routing.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable server-side routing in clusters using an additional bolt connector.
When configured, this allows requests to be forwarded from one cluster member to another, if the requests cannot be satisfied by the first member (e.g. write requests received by a non-leader).
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition label--deprecated-2025.05]
[[config_dbms.routing.load_balancing.plugin]]
=== `dbms.routing.load_balancing.plugin`

.dbms.routing.load_balancing.plugin
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Vary the order of the entries in routing tables each time one is produced. This means that different clients should select a range of servers as their first contact, reducing the chance of all clients contacting the same server if alternatives are available. This makes the load across the servers more even.
|Valid values
a|A string.
|Default value
m|+++server_policies+++
|===


[role=label--enterprise-edition]
[[config_dbms.routing.load_balancing.shuffle_enabled]]
=== `dbms.routing.load_balancing.shuffle_enabled`

.dbms.routing.load_balancing.shuffle_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Vary the order of the entries in routing tables each time one is produced. This means that different clients should select a range of servers as their first contact, reducing the chance of all clients contacting the same server if alternatives are available. This makes the load across the servers more even.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_dbms.routing.reads_on_primaries_enabled]]
=== `dbms.routing.reads_on_primaries_enabled`

.dbms.routing.reads_on_primaries_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure if the `dbms.routing.getRoutingTable()` procedure should include non-writer primaries as read endpoints or return only secondaries. +
NOTE: If there are no secondaries for the given database, primaries are returned as read endpoints, regardless the value of this setting. Defaults to `true` so that non-writer primaries are available for read-only queries in a typical heterogeneous setup.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.routing.reads_on_writers_enabled]]
=== `dbms.routing.reads_on_writers_enabled`

.dbms.routing.reads_on_writers_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure if the `dbms.routing.getRoutingTable()` procedure should include the writer as read endpoint or return only non-writers (non-writer primaries and secondaries). +
NOTE: Writer is returned as read endpoint if no other member is present.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_dbms.routing_ttl]]
=== `dbms.routing_ttl`

.dbms.routing_ttl
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|How long callers should cache the response of the routing procedure `dbms.routing.getRoutingTable()`.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`) that is minimum `1s`.
|Default value
m|+++5m+++
|===



== Cypher settings

The Cypher settings affect the behavior of Cypher queries.
They can be used to tune the performance of Cypher queries or to restrict the kinds of queries that can be executed.
For more information, see xref:/performance/statistics-execution-plans.adoc[Statistics and execution plans].


[role=label--new-2025.06]
[[config_db.query.default_language]]
=== `db.query.default_language`

.db.query.default_language
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The default language of a database determines which language is used to evaluate queries that do not explicitly select a language. This setting determines the default language used for new (and initial) databases where not specified as part of `CREATE` or `ALTER` database.
|Valid values
a|One of [CYPHER_5, CYPHER_25]. label:changed[Changed in 2025.07]
|Default value
m|+++CYPHER_5+++
|===


[[config_dbms.cypher.forbid_exhaustive_shortestpath]]
=== `dbms.cypher.forbid_exhaustive_shortestpath`

.dbms.cypher.forbid_exhaustive_shortestpath
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|This setting is associated with performance optimization. Set this to `true` in situations where it is preferable to have any queries using the 'shortestPath' function terminate as soon as possible with no answer, rather than potentially running for a long time attempting to find an answer (even if there is no path to be found). For most queries, the 'shortestPath' algorithm will return the correct answer very quickly. However there are some cases where it is possible that the fast bidirectional breadth-first search algorithm will find no results even if they exist. This can happen when the predicates in the `WHERE` clause applied to 'shortestPath' cannot be applied to each step of the traversal, and can only be applied to the entire path. When the query planner detects these special cases, it will plan to perform an exhaustive depth-first search if the fast algorithm finds no paths. However, the exhaustive search may be orders of magnitude slower than the fast algorithm. If it is critical that queries terminate as soon as possible, it is recommended that this option be set to `true`, which means that Neo4j will never consider using the exhaustive search for shortestPath queries. However, please note that if no paths are found, an error will be thrown at run time, which will need to be handled by the application.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_dbms.cypher.forbid_shortestpath_common_nodes]]
=== `dbms.cypher.forbid_shortestpath_common_nodes`

.dbms.cypher.forbid_shortestpath_common_nodes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|This setting is associated with performance optimization. The shortest path algorithm does not work when the start and end nodes are the same. With this setting set to `false` no path will be returned when that happens. The default value of `true` will instead throw an exception. This can happen if you perform a shortestPath search after a cartesian product that might have the same start and end nodes for some of the rows passed to shortestPath. If it is preferable to not experience this exception, and acceptable for results to be missing for those rows, then set this to `false`. If you cannot accept missing results, and really want the shortestPath between two common nodes, then re-write the query using a standard Cypher variable length pattern expression followed by ordering by path length and limiting to one result.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_dbms.cypher.hints_error]]
=== `dbms.cypher.hints_error`

.dbms.cypher.hints_error
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set this to specify the behavior when Cypher planner or runtime hints cannot be fulfilled. If `true`, then non-conformance will result in an error, otherwise only a warning is generated.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_dbms.cypher.infer_schema_parts]]
=== `dbms.cypher.infer_schema_parts`

.dbms.cypher.infer_schema_parts
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Allow label inference during cardinality estimation. If the planner can logically deduce that a node has a label not explicitly expressed in the query, the planner will use this information during cardinality estimation. +
This setting controls to what extent the planner should do that:

* `OFF`: No predicates are inferred.
* `MOST_SELECTIVE_LABEL`: Relationship types are used to infer labels on the relationships' end nodes.
The planner only infers at most one label per node.
If more than one label can be inferred for a given node, the planner keeps the most selective one, the one corresponding to the smallest number of nodes in the graph.
|Valid values
a|One of [MOST_SELECTIVE_LABEL, OFF].
|Default value
m|+++OFF+++
|===

For some queries, the planner can infer predicates such as labels or types from the graph structure that can improve estimating the number of rows that each operator produces.
for more information, see link:{neo4j-docs-base-uri}/cypher-manual/current/planning-and-tuning/execution-plans/[Cypher Manual -> Execution plans and query tuning -> Understanding execution plans]. +
For details on how to configure this setting on a per-query basis,effectively overriding this setting on that particular query, see link:{neo4j-docs-base-uri}/cypher-manual/current/planning-and-tuning/query-tuning/#cypher-infer-schema-parts[Cypher Manual -> Query tuning -> Cypher infer schema parts].

// In general, inferring more information should improve the estimation and thereby the planner's decisions.
// Should this not be the case, this setting provides the means to disable inference.

[[config_dbms.cypher.lenient_create_relationship]]
=== `dbms.cypher.lenient_create_relationship`

.dbms.cypher.lenient_create_relationship
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set this to change the behavior for Cypher create relationship when the start or end node is missing. By default this fails the query and stops execution, but by setting this flag the create operation is simply not performed and execution continues.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_dbms.cypher.min_replan_interval]]
=== `dbms.cypher.min_replan_interval`

.dbms.cypher.min_replan_interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The minimum time between possible Cypher query replanning events. After this time, the graph statistics will be evaluated, and if they have changed by more than the value set by <<config_dbms.cypher.statistics_divergence_threshold,`dbms.cypher.statistics_divergence_threshold`>>, the query will be replanned. If the statistics have not changed sufficiently, the same interval will need to pass before the statistics will be evaluated again. Each time they are evaluated, the divergence threshold will be reduced slightly until it reaches 10% after 7h, so that even moderately changing databases will see query replanning after a sufficiently long time interval.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++10s+++
|===


[[config_dbms.cypher.planner]]
=== `dbms.cypher.planner`

.dbms.cypher.planner
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set this to specify the default planner for the default language version.
|Valid values
a|One of [DEFAULT, COST].
|Default value
m|+++DEFAULT+++
|===


[role=label--dynamic]
[[config_dbms.cypher.render_plan_description]]
=== `dbms.cypher.render_plan_description`

.dbms.cypher.render_plan_description
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|If set to `true` a textual representation of the plan description will be rendered on the server for all queries running with `EXPLAIN` or `PROFILE`. This allows clients such as the neo4j browser and Cypher shell to show a more detailed plan description.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_dbms.cypher.statistics_divergence_threshold]]
=== `dbms.cypher.statistics_divergence_threshold`

.dbms.cypher.statistics_divergence_threshold
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The threshold for statistics above which a plan is considered stale.

If any of the underlying statistics used to create the plan have changed more than this value, the plan will be considered stale and will be replanned. Change is calculated as `abs(a-b)/max(a,b)`.

This means that a value of `0.75` requires the database to quadruple in size before query replanning. A value of `0` means that the query will be replanned as soon as there is any change in statistics and the replan interval has elapsed.

This interval is defined by <<config_dbms.cypher.min_replan_interval,`dbms.cypher.min_replan_interval`>> and defaults to 10s. After this interval, the divergence threshold will slowly start to decline, reaching 10% after about 7h. This will ensure that long running databases will still get query replanning on even modest changes, while not replanning frequently unless the changes are very large.
|Valid values
a|A double that is in the range `0.0` to `1.0`.
|Default value
m|+++0.75+++
|===

[role=label--dynamic label--new-2026.05]
[[config_dbms.cypher.transactions.default_subquery_batch_strategy]]
=== `dbms.cypher.transactions.default_subquery_batch_strategy`

.dbms.cypher.transactions.default_subquery_batch_strategy
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a| The default batching strategy for subquery transactions in a query with a `CALL () { ... } IN CONCURRENT TRANSACTIONS ...` clause.
When set to `NONE`, batches are dispatched without dependency analysis.
When set to `AUTO`, the query planner analyzes the query and, where possible, applies a batch formation and scheduling strategy that attempts to prevent deadlocks between concurrent batches.
When set to `DEFAULT`, the current product default is used (currently `NONE`, but may be subject to change in future versions).
This setting is only used when no `DISJOINT BY` option is explicitly specified in the query.
E.g. `CALL () { ... } IN CONCURRENT TRANSACTIONS ... DISJOINT BY AUTO` overrides this setting, applying the automatic strategy to that query.
| Valid values
| One of [DEFAULT, NONE, AUTO].
| Default value
m|+++DEFAULT+++
|===


[role=label--dynamic label--new-2025.03]
[[config_dbms.cypher.transactions.default_subquery_retry_timeout]]
=== `dbms.cypher.transactions.default_subquery_retry_timeout`

.dbms.cypher.transactions.default_subquery_retry_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The default maximum amount of time to attempt retries of a subquery transaction that fails with a transient error in a query with a `CALL () { ... } IN TRANSACTIONS ... ON ERROR RETRY ...` clause. This setting is only used when no retry timeout is explicitly specified in the query. E.g. `CALL () { ... } IN TRANSACTIONS ... ON ERROR RETRY FOR 10 SECONDS` would override this setting with a 10 second retry timeout for that particular query.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s).
|Default value
m|+++30s+++
|===

[role=label--enterprise-edition]
[[config_server.cypher.parallel.worker_limit]]
=== `server.cypher.parallel.worker_limit`

.server.cypher.parallel.worker_limit
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a| Number of threads to allocate to Cypher worker threads for the parallel runtime.
If set to a positive number, that number of workers will be started.
If set to `0`, one worker will be started for every logical processor available to the Java Virtual Machine.

If set to a negative number, the total number of logical processors available on the server will be reduced by the absolute value of that number.
For example, if the server has 16 available processors and you set `server.cypher.parallel.worker_limit` to `-1`, the parallel runtime will have 15 threads available.

|Valid values
a| An integer.

|Default value
m|+++0+++
|===

