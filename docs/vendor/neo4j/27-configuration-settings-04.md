---
name: 27-configuration-settings-04
description: "Neo4j 2026.06.0 — Configuration settings reference (4/6): metrics, Neo4j Browser/client, Kubernetes (25/60, config)"
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



== Metrics settings

The metrics settings control whether Neo4j will log metrics, what metrics to log, how to log them, and how to expose them.
For better understanding of the metrics settings and how to configure them, see xref:monitoring/metrics/index.adoc[Metrics].


[role=label--enterprise-edition]
[[config_server.metrics.csv.enabled]]
=== `server.metrics.csv.enabled`

.server.metrics.csv.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set to `true` to enable exporting metrics to CSV files.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.csv.interval]]
=== `server.metrics.csv.interval`

.server.metrics.csv.interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The reporting interval for the CSV files. That is, how often new rows with numbers are appended to the CSV files.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`) that is minimum `1ms`.
|Default value
m|+++30s+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.csv.rotation.compression]]
=== `server.metrics.csv.rotation.compression`

.server.metrics.csv.rotation.compression
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Decides what compression to use for the csv history files.
|Valid values
a|One of [NONE, ZIP, GZ].
|Default value
m|+++ZIP+++ label:changed[Changed in 2025.01]
|===


[role=label--enterprise-edition]
[[config_server.metrics.csv.rotation.keep_number]]
=== `server.metrics.csv.rotation.keep_number`

.server.metrics.csv.rotation.keep_number
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum number of history files for the csv files.
|Valid values
a|An integer that is minimum `1`.
|Default value
m|+++7+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.csv.rotation.size]]
=== `server.metrics.csv.rotation.size`

.server.metrics.csv.rotation.size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The file size in bytes at which the csv files will auto-rotate. If set to zero then no rotation will occur. Accepts a binary suffix `k`, `m` or `g`.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`) that is in the range `0B` to `8388608.00TiB`.
|Default value
m|+++10.00MiB+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.enabled]]
=== `server.metrics.enabled`

.server.metrics.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable metrics. Setting this to `false` will to turn off all metrics.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.filter]]
=== `server.metrics.filter`

.server.metrics.filter
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Specifies which metrics should be enabled by using a comma separated list of globbing patterns. Only the metrics matching the filter will be enabled. For example `\*check_point*,neo4j.page_cache.evictions` will enable any checkpoint metrics and the pagecache eviction metric.
|Valid values
a|A comma-separated list where each element is A simple globbing pattern that can use `*` and `?`..
|Default value
m|+++*bolt.connections*,*bolt.messages_received*,*bolt.messages_started*,*dbms.pool.bolt.free,*dbms.pool.bolt.total_size,*dbms.pool.bolt.total_used,*dbms.pool.bolt.used_heap,*cluster.raft.is_leader,*cluster.raft.last_leader_message,*cluster.raft.replication_attempt,*cluster.raft.replication_fail,*cluster.raft.last_applied,*cluster.raft.last_appended,*cluster.raft.append_index,*cluster.raft.commit_index,*cluster.raft.applied_index,*check_point.*,*cypher.replan_events,*cypher.cache*,*ids_in_use*,*.neo4j.count.*,*pool.transaction.*.total_used,*pool.transaction.*.used_heap,*pool.transaction.*.used_native,*store.size*,*transaction.active_read,*transaction.active_write,*transaction.committed*,*transaction.last_committed_tx_id,*transaction.peak_concurrent,*transaction.rollbacks*,*page_cache.hit*,*page_cache.page_faults,*page_cache.usage_ratio,*vm.file.descriptors.count,*vm.gc.time.*,*vm.heap.used,*vm.memory.buffer.direct.used,*vm.memory.pool.g1_eden_space,*vm.memory.pool.g1_old_gen,*vm.pause_time,*vm.thread*,*db.query.execution*,*protocol*+++ label:changed[Changed in 2025.03] label:changed[Changed in 2025.06]
|===

[NOTE]
====
The default value of the `server.metrics.filter` was changed in Neo4j 2025.03 and 2025.06.

For details, see the xref:changes-2025-2026.adoc#configuration-settings-changes[Changes in Neo4j 2025-2026 series].
====

[role=label--enterprise-edition label--new-2025.10]
[[config_server.metrics.deny_filter]]
=== `server.metrics.deny_filter`
.server.metrics.deny_filter
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Specifies which metrics should be disabled by using a comma-separated list of globbing patterns. Overrides the enabled metrics of `server.metrics.filter`. For example, if `server.metrics.filter` contains `neo4j.page_cache.*` and `server.metrics.deny_filter` contains `neo4j.page_cache.page_faults`, it will enable all pagecache metrics, except the `neo4j.page_cache.page_faults` metric.
|Valid values
a|A comma-separated list where each element is A simple globbing pattern that can use `*` and `?`..
|Default value
m|++++++
|===

[role=label--enterprise-edition]
[[config_server.metrics.graphite.enabled]]
=== `server.metrics.graphite.enabled`

.server.metrics.graphite.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set to `true` to enable exporting metrics to Graphite.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.graphite.interval]]
=== `server.metrics.graphite.interval`

.server.metrics.graphite.interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The reporting interval for Graphite. That is, how often to send updated metrics to Graphite.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++30s+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.graphite.server]]
=== `server.metrics.graphite.server`

.server.metrics.graphite.server
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The hostname or IP address of the Graphite server.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from server.default_listen_address.
|Default value
m|+++:2003+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.jmx.enabled]]
=== `server.metrics.jmx.enabled`

.server.metrics.jmx.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set to `true` to enable the JMX metrics endpoint.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.prefix]]
=== `server.metrics.prefix`

.server.metrics.prefix
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A common prefix for the reported metrics field names.
|Valid values
a|A string.
|Default value
m|+++neo4j+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.prometheus.enabled]]
=== `server.metrics.prometheus.enabled`

.server.metrics.prometheus.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set to `true` to enable the Prometheus endpoint.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition]
[[config_server.metrics.prometheus.endpoint]]
=== `server.metrics.prometheus.endpoint`

.server.metrics.prometheus.endpoint
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The hostname and port to use as Prometheus endpoint.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from `server.default_listen_address`.
|Default value
m|+++localhost:2004+++
|===



== Neo4j Browser and client settings

Neo4j Browser and client settings apply only to Neo4j Browser and the client.


[role=label--enterprise-edition]
[[config_browser.allow_outgoing_connections]]
=== `browser.allow_outgoing_connections`

.browser.allow_outgoing_connections
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure the policy for outgoing Neo4j Browser connections.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_browser.credential_timeout]]
=== `browser.credential_timeout`

.browser.credential_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure the Neo4j Browser to time out logged in users after this idle period. Setting this to 0 indicates no limit.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s).
|Default value
m|+++0s+++
|===


[[config_browser.post_connect_cmd]]
=== `browser.post_connect_cmd`

.browser.post_connect_cmd
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Commands to be run when Neo4j Browser successfully connects to this server. Separate multiple commands with semi-colon.
|Valid values
a|A string.
|Default value
m|++++++
|===


[[config_browser.remote_content_hostname_whitelist]]
=== `browser.remote_content_hostname_whitelist`

.browser.remote_content_hostname_whitelist
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Whitelist of hosts for the Neo4j Browser to be allowed to fetch content from.
|Valid values
a|A string.
|Default value
m|+++guides.neo4j.com,localhost+++
|===


[role=label--enterprise-edition]
[[config_browser.retain_connection_credentials]]
=== `browser.retain_connection_credentials`

.browser.retain_connection_credentials
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure the Neo4j Browser to store or not store user credentials.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===

[IMPORTANT]
====
The `browser.retain_connection_credentials` is *not* supported by the new, default version of Neo4j Browser and if set, it is ignored in such cases.
====



[role=label--enterprise-edition]
[[config_browser.retain_editor_history]]
=== `browser.retain_editor_history`

.browser.retain_editor_history
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure the Neo4j Browser to store or not store user editor history.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_client.allow_telemetry]]
=== `client.allow_telemetry`

.client.allow_telemetry
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure client applications such as Browser and Bloom to send Product Analytics data.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


== Kubernetes settings

The Kubernetes settings are used to configure a cluster running on https://kubernetes.io/[Kubernetes], where each server is running as a Kubernetes service.
The addresses of the other servers can be obtained using the List Service API, as described in the https://kubernetes.io/docs/reference/kubernetes-api/[Kubernetes API documentation].
For more information, see xref:clustering/setup/discovery.adoc#clustering-discovery-k8s[Discovery in Kubernetes].


.Kubernetes settings
[role=label--enterprise-edition]
[[config_dbms.kubernetes.address]]
=== `dbms.kubernetes.address`

.dbms.kubernetes.address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Address for Kubernetes API.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`.
|Default value
m|+++kubernetes.default.svc:443+++
|===


[role=label--enterprise-edition]
[[config_dbms.kubernetes.ca_crt]]
=== `dbms.kubernetes.ca_crt`

.dbms.kubernetes.ca_crt
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|File location of CA certificate for Kubernetes API.
|Valid values
a|A path.
|Default value
m|+++/var/run/secrets/kubernetes.io/serviceaccount/ca.crt+++
|===


[role=label--enterprise-edition]
[[config_dbms.kubernetes.cluster_domain]]
=== `dbms.kubernetes.cluster_domain`

.dbms.kubernetes.cluster_domain
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Kubernetes cluster domain.
|Valid values
a|A string.
|Default value
m|+++cluster.local+++
|===


[role=label--enterprise-edition]
[[config_dbms.kubernetes.label_selector]]
=== `dbms.kubernetes.label_selector`

.dbms.kubernetes.label_selector
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|LabelSelector for Kubernetes API.
|Valid values
a|A string.
|Default value
m|
|===


[role=label--enterprise-edition]
[[config_dbms.kubernetes.namespace]]
=== `dbms.kubernetes.namespace`

.dbms.kubernetes.namespace
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|File location of namespace for Kubernetes API.
|Valid values
a|A path.
|Default value
m|+++/var/run/secrets/kubernetes.io/serviceaccount/namespace+++
|===


[role=label--enterprise-edition label--renamed-2025.01]
[[config_dbms.kubernetes.discovery.service_port_name]]
=== `dbms.kubernetes.discovery.service_port_name`

.dbms.kubernetes.discovery.service_port_name
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Service port name for discovery for Kubernetes API.
|Valid values
a|A string.
|Default value
m|+++transaction+++
|===


[role=label--enterprise-edition]
[[config_dbms.kubernetes.token]]
=== `dbms.kubernetes.token`

.dbms.kubernetes.token
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|File location of token for Kubernetes API.
|Valid values
a|A path.
|Default value
m|+++/var/run/secrets/kubernetes.io/serviceaccount/token+++
|===
