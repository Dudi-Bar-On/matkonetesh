---
name: 27-configuration-settings-01
description: "Neo4j 2026.06.0 — Configuration settings reference (1/6): dynamic settings, setting groups, checkpoint, cloud storage, cluster (22/60, config)"
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



== Dynamic configuration settings

Dynamic settings can be changed at runtime, without restarting the service.

Dynamic settings are labeled label:dynamic[].

[NOTE]
====
Changes to the configuration at runtime are not persisted.
To avoid losing changes when restarting Neo4j, make sure you update xref:configuration/file-locations.adoc[_neo4j.conf_] as well.

In a clustered environment, `CALL dbms.setConfigValue` affects only the server it is run against, and it is not propagated to other members.
If you want to change the configuration settings on all cluster members, you have to run the procedure against each of them and update their _neo4j.conf_ file.

Each member of the cluster has its own _neo4j.conf_ file.
It is recommended that the settings for a database are the same across all members of the cluster.
====

For more information on how to update dynamic configuration settings, see xref:configuration/dynamic-settings.adoc[Update dynamic settings].


[role=label--enterprise-edition label--deprecated-2025.05]

== Configuration setting group

When deploying a multi-data cluster in Neo4j, you can configure the load balancing framework.

In Neo4j, the load balancing system is based on a plugin architecture.
The primary built-in plugin is `server_policies`, which is set up by the following property:

[source, shell]
----
dbms.routing.load_balancing.plugin=server_policies
----

`server_policies` plugin determines which servers are eligible to serve client requests based on predefined routing policies.
If a client does not specify a routing policy, the system defaults to using all available servers.

You can define routing policies by using the following property format:

[source, shell]
----
dbms.routing.load_balancing.config.server_policies.<policy-name>=<policy-definition>
----

Where `<policy-name>` is the name of the routing policy, and `<policy-definition>` specifies the server selection logic.

For the default policy, the `default` policy name is reserved.
Its default value is `all()`:

[source, properties]
----
dbms.routing.load_balancing.config.server_policies.default=all()
----

See xref:clustering/multi-region-deployment/multi-data-center-routing.adoc#mdc-load-balancing-framework[Clustering -> Multi-data center routing] for more details.



== Checkpoint settings

Checkpointing is the process of flushing all pending page updates from the page cache to the store files.
This is done periodically and is used to recover the database in case of a crash.
The checkpoint settings control the frequency of checkpoints, and the amount of data that is written to disk in each checkpoint.
See also, <<Transaction log settings>>.

[[config_db.checkpoint]]
=== `db.checkpoint`

.db.checkpoint
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configures the general policy for when checkpoints should occur.
Possible values are:

* `PERIODIC` (default)- it runs a checkpoint as per the interval specified by <<config_db.checkpoint.interval.tx,`db.checkpoint.interval.tx`>> and <<config_db.checkpoint.interval.time,`db.checkpoint.interval.time`>>.

* `VOLUME` -- it runs a checkpoint when the size of the transaction logs reaches the value specified by the <<config_db.checkpoint.interval.volume,`db.checkpoint.interval.volume`>> setting. By default, it is set to `250.00MiB`.

* `CONTINUOUS` (Enterprise Edition) -- it ignores <<config_db.checkpoint.interval.tx,`db.checkpoint.interval.tx`>> and <<config_db.checkpoint.interval.time,`db.checkpoint.interval.time`>> settings and runs the checkpoint process all the time.

* `VOLUMETRIC` (Enterprise Edition) -- it makes the best effort to checkpoint often enough so that the database does not get too far behind on deleting old transaction logs as specified in the <<config_db.tx_log.rotation.retention_policy,`db.tx_log.rotation.retention_policy`>> setting.
|Valid values
a|One of [PERIODIC, CONTINUOUS, VOLUME, VOLUMETRIC].
|Default value
m|+++PERIODIC+++
|===


[[config_db.checkpoint.interval.time]]
=== `db.checkpoint.interval.time`

.db.checkpoint.interval.time
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configures the time interval between checkpoints.
The database does not checkpoint more often than the specified interval (unless checkpointing is triggered by a different event) but might checkpoint less often if performing a checkpoint takes longer time than the configured interval.
A checkpoint is a point in the transaction logs from which recovery starts.
Longer checkpoint intervals typically mean that recovery takes longer to complete in case of a crash.
On the other hand, a longer checkpoint interval can also reduce the I/O load that the database places on the system, as each checkpoint implies a flushing and forcing of all the store files.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++15m+++
|===


[[config_db.checkpoint.interval.tx]]
=== `db.checkpoint.interval.tx`

.db.checkpoint.interval.tx
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configures the transaction interval between checkpoints.
The database does not checkpoint more often than the specified interval (unless checkpointing is triggered by a different event) but might checkpoint less often if performing a checkpoint takes longer time than the configured interval.
A checkpoint is a point in the transaction logs from which recovery starts.
Longer checkpoint intervals typically mean that recovery takes longer to complete in case of a crash.
On the other hand, a longer checkpoint interval can also reduce the I/O load that the database places on the system, as each checkpoint implies a flushing and forcing of all the store files.
The default is `100000` for a checkpoint every 100000 transactions.
|Valid values
a|An integer that is minimum `1`.
|Default value
m|+++100000+++
|===


[[config_db.checkpoint.interval.volume]]
=== `db.checkpoint.interval.volume`

.db.checkpoint.interval.volume
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configures the volume of transaction logs between checkpoints.
The database does not checkpoint more often than the specified interval (unless checkpointing is triggered by a different event) but might checkpoint less often if performing a checkpoint takes longer time than the configured interval.
A checkpoint is a point in the transaction logs, which recovery would start from.
Longer checkpoint intervals typically mean that recovery takes longer to complete in case of a crash.
On the other hand, a longer checkpoint interval can also reduce the I/O load that the database places on the system, as each checkpoint implies a flushing and forcing of all the store files.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`) that is minimum `1.00KiB`.
|Default value
m|+++250.00MiB+++
|===


[role=label--dynamic]
[[config_db.checkpoint.iops.limit]]
=== `db.checkpoint.iops.limit`

label:enterprise-edition[Enterprise Edition] label:dynamic[Dynamic]

.db.checkpoint.iops.limit
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Limit the number of IOs the background checkpoint process consumes per second.
This setting is advisory.
It is ignored in Neo4j Community Edition and is followed to best effort in Enterprise Edition.
An IO is, in this case, an 8 KiB (mostly sequential) write.
Limiting the write IO in this way leaves more bandwidth in the IO subsystem to service random-read IOs, which is important for the response time of queries when the database cannot fit entirely in memory.
The only drawback of this setting is that longer checkpoint times may lead to slightly longer recovery times in case of a database or system crash.
A lower number means lower IO pressure and, consequently, longer checkpoint times.
Set this to `-1` to disable the IOPS limit and remove the limitation entirely.
This lets the checkpointer flush data as fast as the hardware goes.
Removing or commenting out the setting sets the default value of `600`.
|Valid values
a|An integer.
|Default value
m|+++600+++
|===


[role=label--new-2025.07 label--dynamic]
[[config_db.checkpoint.throughput.limit]]
=== `db.checkpoint.throughput.limit`

.db.checkpoint.throughput.limit
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Limit the write throughput per second of the background checkpoint process. This setting is advisory. It is ignored in Neo4j Community Edition and is followed to best effort in Enterprise Edition. Limiting the write IO in this way leaves more bandwidth in the IO subsystem to service random-read IOs, which is important for the response time of queries when the database cannot fit entirely in memory. The only drawback of this setting is that longer checkpoint times may lead to slightly longer recovery times in case of a database or system crash. A lower number means lower IO pressure and, consequently, longer checkpoint times. Set this to null to disable the throughput limit and fallback to IOPS limit.
|Valid values
a|A byte size (valid multipliers are B, KiB, KB, K, kB, kb, k, MiB, MB, M, mB, mb, m, GiB, GB, G, gB, gb, g, TiB, TB, PiB, PB, EiB, EB) that is minimum 8.00KiB.
|Default value
m|++++++
|===


== Cloud storage integration settings

Cloud integration settings allow you to specify custom Azure blob storage endpoints and host authorities, set the project ID for Google Cloud Storage buckets, and define the desired throughput for transfer operations in Amazon S3.

[role=label--enterprise-edition label--new-2025.03]
[[config_dbms.integrations.cloud_storage.azb.blob_endpoint_suffix]]
=== `dbms.integrations.cloud_storage.azb.blob_endpoint_suffix`

.dbms.integrations.cloud_storage.azb.blob_endpoint_suffix
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Azure blob storage endpoint suffix. You need to change this if you are not using Azure public cloud (e.g., if you are using Azure Government).
|Valid values
a|A string.
|Default value
m|+++blob.core.windows.net+++
|===


[role=label--enterprise-edition label--new-2025.03]
[[config_dbms.integrations.cloud_storage.azb.authority_endpoint]]
=== `dbms.integrations.cloud_storage.azb.authority_endpoint`

.dbms.integrations.cloud_storage.azb.authority_endpoint
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Azure authority host endpoint (only required for certain methods of authentication, it should be specified in its full form - e.g., https://login.microsoftonline.com).
|Valid values
a|A string.
|Default value
m|++++++
|===


[role=label--enterprise-edition label--new-2025.03]
[[config_dbms.integrations.cloud_storage.gs.project_id]]
=== `dbms.integrations.cloud_storage.gs.project_id`

.dbms.integrations.cloud_storage.gs.project_id
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Project ID of the Google storage bucket(s) to connect to, falling back to the value found by their SDK.
|Valid values
a|A string.
|Default value
m|++++++
|===


[role=label--enterprise-edition label--new-2025.03]
[[config_dbms.integrations.cloud_storage.s3.target_throughput_gbps]]
=== `dbms.integrations.cloud_storage.s3.target_throughput_gbps`

.dbms.integrations.cloud_storage.s3.target_throughput_gbps
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The target throughput for transfer requests. Higher value means more connections will be established with S3. It's recommended to set it to the maximum network bandwidth on the host that the application is running on. The default is `10.0`, but when running on EC2 instances, this value can often be set much higher (being specific to the EC2 instance type).
|Valid values
a|A double.
|Default value
m|+++10.0+++
|===



== Cluster settings

The cluster settings are used to configure the behavior of a Neo4j cluster.
For more information, see also xref:clustering/settings.adoc[Clustering settings].


[role=label--enterprise-edition]
[[config_db.cluster.catchup.pull_interval]]
=== `db.cluster.catchup.pull_interval`

.db.cluster.catchup.pull_interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The interval at which a secondary server fetches updates for a specific database from the primary server for that database.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++1s+++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.apply.buffer.max_bytes]]
=== `db.cluster.raft.apply.buffer.max_bytes`

.db.cluster.raft.apply.buffer.max_bytes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of bytes in the apply buffer. This parameter limits the amount of memory that can be consumed by the apply buffer. If the bytes limit is reached, buffer size will be limited even if max_entries is not exceeded.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|+++1.00GiB+++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.apply.buffer.max_entries]]
=== `db.cluster.raft.apply.buffer.max_entries`

.db.cluster.raft.apply.buffer.max_entries
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of entries in the raft log entry prefetch buffer.
|Valid values
a|An integer.
|Default value
m|+++1024+++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.in_queue.batch.max_bytes]]
=== `db.cluster.raft.in_queue.batch.max_bytes`

.db.cluster.raft.in_queue.batch.max_bytes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Largest batch processed by RAFT in bytes.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|+++8.00MiB+++
|===

[role=label--enterprise-edition]
[[config_db.cluster.raft.so_keepalive_enabled]]
=== `db.cluster.raft.so_keepalive_enabled`

.db.cluster.raft.so_keepalive_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set the keepalive socket option (SO_KEEPALIVE) for all Raft TCP channels.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.in_queue.max_bytes]]
=== `db.cluster.raft.in_queue.max_bytes`

.db.cluster.raft.in_queue.max_bytes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum number of bytes in the RAFT in-queue.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|+++2.00GiB+++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.leader_transfer.priority_tag]]
=== `db.cluster.raft.leader_transfer.priority_tag`

.db.cluster.raft.leader_transfer.priority_tag
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The name of a server tag whose members should be prioritized as leaders. This does not guarantee that the leader will always be a member of this tag, but the cluster will attempt to transfer the leadership to such a member when possible. If a database is specified using `db.cluster.raft.leader_transfer.priority_tag`.<database>, the specified priority tag will apply only to that database. If no database is specified, that tag will be the default and apply to all databases with no explicitly set priority tag. Using this setting will disable leadership balancing.
|Valid values
a|A string identifying a server tag.
|Default value
m|++++++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.log.prune_strategy]]
=== `db.cluster.raft.log.prune_strategy`

.db.cluster.raft.log.prune_strategy
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|RAFT log pruning strategy that determines which logs are to be pruned. Neo4j only prunes log entries up to the last applied index, which guarantees that logs are only marked for pruning once the transactions within are safely copied over to the local transaction logs and safely committed by a majority of cluster members. Possible values are a byte size or a number of transactions (e.g., 200K txs).
|Valid values
a|A string.
|Default value
m|+++1g size+++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.log_shipping.buffer.max_bytes]]
=== `db.cluster.raft.log_shipping.buffer.max_bytes`

.db.cluster.raft.log_shipping.buffer.max_bytes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of bytes in the in-flight cache. This parameter limits the amount of memory that can be consumed by the cache. If the bytes limit is reached, cache size will be limited even if max_entries is not exceeded.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|+++1.00GiB+++
|===


[role=label--enterprise-edition]
[[config_db.cluster.raft.log_shipping.buffer.max_entries]]
=== `db.cluster.raft.log_shipping.buffer.max_entries`

.db.cluster.raft.log_shipping.buffer.max_entries
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of entries in the in-flight cache. Increasing size requires more memory but might improve performance in high-load situations.
|Valid values
a|An integer.
|Default value
m|+++1024+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.network.client_inactivity_timeout]]
=== `dbms.cluster.network.client_inactivity_timeout`

.dbms.cluster.network.client_inactivity_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A network request times out if the given duration elapses with no network activity. Every message received by the client from the server extends the timeout duration.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++10m+++
|===

[role=label--enterprise-edition label--renamed-2025.01]
[[config_dbms.cluster.endpoints]]
=== `dbms.cluster.endpoints`

.dbms.cluster.endpoints
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A comma-separated list of endpoints which a server should contact in order to discover other cluster members.
All cluster members hosting a `system` database primary must be specified in this list.
However, it is typical that all cluster members, including the current server, are specified in this list.
|Valid values
a|A comma-separated list where each element is a socket address in the format of `hostname:port`, `hostname`, or `:port`.
|Default value
m|
|===

[role=label--enterprise-edition]
[[config_dbms.cluster.discovery.resolver_type]]
=== `dbms.cluster.discovery.resolver_type`

.dbms.cluster.discovery.resolver_type
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configure the resolver type that the discovery service uses for determining who should be part of the cluster.
Valid values are `LIST`, `SRV`, `DNS`, and `K8S`:

`LIST`::
 A static configuration where `dbms.cluster.endpoints` must contain a list of the addresses of the cluster members.
`SRV` and `DNS`::
 A dynamic configuration where `dbms.cluster.endpoints` must point to a DNS entry containing the cluster members' addresses.
`K8S`::
 At least `dbms.kubernetes.discovery.service_port_name` must be set.  The addresses of the cluster members are queried dynamically from Kubernetes.
|Valid values
a|A string.
|Default value
m|+++LIST+++
|===

[role=label--enterprise-edition]
[[config_dbms.cluster.minimum_initial_system_primaries_count]]
=== `dbms.cluster.minimum_initial_system_primaries_count`

.dbms.cluster.minimum_initial_system_primaries_count
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Minimum number of machines initially required to form a clustered DBMS. The cluster is considered formed when at least this many members have discovered each other, bound together, and bootstrapped a highly available system database. As a result, at least this many of the cluster's initial machines must have <<config_server.cluster.system_database_mode,`server.cluster.system_database_mode`>> set to `PRIMARY`. +
NOTE: If <<config_dbms.cluster.discovery.resolver_type,`dbms.cluster.discovery.resolver_type`>> is set to `LIST` and <<config_dbms.cluster.endpoints,`dbms.cluster.endpoints`>> is empty, then the user is assumed to be deploying a standalone DBMS, and the value of this setting is ignored.
|Valid values
a|An integer that is minimum `1`.
|Default value
m|+++3+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.cluster.network.connect_timeout]]
=== `dbms.cluster.network.connect_timeout`

.dbms.cluster.network.connect_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum amount of time to wait for a network connection to be established.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++30s+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.network.handshake_timeout]]
=== `dbms.cluster.network.handshake_timeout`

.dbms.cluster.network.handshake_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Time out for protocol negotiation handshake.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++20s+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.network.max_chunk_size]]
=== `dbms.cluster.network.max_chunk_size`

.dbms.cluster.network.max_chunk_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum chunk size allowable across a network by clustering machinery.
|Valid values
a|An integer that is in the range `4096` to `10485760`.
|Default value
m|+++32768+++
|===


[role=label--enterprise-edition label--changed-2025.01]
[[config_dbms.cluster.network.supported_compression_algos]]
=== `dbms.cluster.network.supported_compression_algos`

.dbms.cluster.network.supported_compression_algos
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Network compression algorithms that this server will allow in negotiation as a comma-separated list. +
For incoming connections, the algorithms are listed in descending order of preference. An empty list implies no compression. +
For outgoing connections, this merely specifies the allowed set of algorithms and the preference of the remote peer will be used for making the decision. +
Allowable values: [Snappy, Snappy_validating, LZ4 label:deprecated[Deprecated in 2026.01], LZ4_high_compression label:deprecated[Deprecated in 2026.01], LZ_validating label:deprecated[Deprecated in 2026.01], LZ4_high_compression_validating label:deprecated[Deprecated in 2026.01]].
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|++++++
|===

[role=label--enterprise-edition label--new-2025.02]
[[config_dbms.cluster.raft.async_channel_acquisition_enabled]]
=== `dbms.cluster.raft.async_channel_acquisition_enabled`

.dbms.cluster.raft.async_channel_acquisition_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable async acquisition of raft sender channels. If set to `false`, the leader will wait for a connection to a follower before shipping it entries. This may cause latencies in replication if one or more members are slow at establishing connections.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.binding_timeout]]
=== `dbms.cluster.raft.binding_timeout`

.dbms.cluster.raft.binding_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The time allowed for a database on a Neo4j server to either join a cluster or form a new cluster with at least the quorum of the members available. The members are provided by <<config_dbms.cluster.endpoints,`dbms.cluster.endpoints`>> for the system database and by the topology graph for standard databases.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++1d+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.client.max_channels]]
=== `dbms.cluster.raft.client.max_channels`

.dbms.cluster.raft.client.max_channels
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of TCP channels between two nodes to operate the raft protocol. Each database gets allocated one channel, but a single channel can be used by more than one database.
|Valid values
a|An integer.
|Default value
m|+++8+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.election_failure_detection_window]]
=== `dbms.cluster.raft.election_failure_detection_window`

.dbms.cluster.raft.election_failure_detection_window
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The rate at which leader elections happen. Note that due to election conflicts, it might take several attempts to find a leader. The window should be significantly larger than typical communication delays to make conflicts unlikely.
|Valid values
a|A duration-range <min-max> (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++3s-6s+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.leader_failure_detection_window]]
=== `dbms.cluster.raft.leader_failure_detection_window`

.dbms.cluster.raft.leader_failure_detection_window
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The time window within which the loss of the leader is detected and the first re-election attempt is held. The window should be significantly larger than typical communication delays to make conflicts unlikely.
|Valid values
a|A duration-range <min-max> (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++20s-23s+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.leader_transfer.balancing_strategy]]
=== `dbms.cluster.raft.leader_transfer.balancing_strategy`

.dbms.cluster.raft.leader_transfer.balancing_strategy
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Which strategy to use when transferring database leaderships around a cluster. Note that if a `leader_transfer.priority_tag` is specified for a given database, the value of this setting will be ignored for that database.
The following values are available:

* `equal_balancing` automatically ensures that each primary server holds the leader role for an equal number of databases.
* `no_balancing` prevents any automatic balancing of the leader role.
|Valid values
a|One of [NO_BALANCING, EQUAL_BALANCING].
|Default value
m|+++EQUAL_BALANCING+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.log.pruning_frequency]]
=== `dbms.cluster.raft.log.pruning_frequency`

.dbms.cluster.raft.log.pruning_frequency
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|RAFT log pruning frequency.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++10m+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.log.reader_pool_size]]
=== `dbms.cluster.raft.log.reader_pool_size`

.dbms.cluster.raft.log.reader_pool_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|RAFT log reader pool size.
|Valid values
a|An integer.
|Default value
m|+++8+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.log.rotation_size]]
=== `dbms.cluster.raft.log.rotation_size`

.dbms.cluster.raft.log.rotation_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|RAFT log rotation size. The log will be rotated when it reaches this size.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`) that is minimum `1.00KiB`.
|Default value
m|+++250.00MiB+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.membership.join_max_lag]]
=== `dbms.cluster.raft.membership.join_max_lag`

.dbms.cluster.raft.membership.join_max_lag
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum amount of lag accepted for a new follower to join the Raft group.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++10s+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.raft.membership.join_timeout]]
=== `dbms.cluster.raft.membership.join_timeout`

.dbms.cluster.raft.membership.join_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Timeout for a new member to catch up.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++10m+++
|===


[role=label--enterprise-edition]
[[config_dbms.cluster.store_copy.max_retry_time_per_request]]
=== `dbms.cluster.store_copy.max_retry_time_per_request`

.dbms.cluster.store_copy.max_retry_time_per_request
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum retry time per request during store copy. Regular store files and indexes are downloaded in separate requests during store copy. This configures the maximum time failed requests are allowed to resend.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++20m+++
|===


[role=label--enterprise-edition]
[[config_initial.dbms.automatically_enable_free_servers]]
=== `initial.dbms.automatically_enable_free_servers`

.initial.dbms.automatically_enable_free_servers
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Automatically enables servers that are in the `FREE` state - not only during the initial DBMS startup but also whenever a new server joins the cluster.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition]
[[config_initial.dbms.default_primaries_count]]
=== `initial.dbms.default_primaries_count`

.initial.dbms.default_primaries_count
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The initial default number of primaries for the standard databases. Initialized at the first DBMS startup. If the user does not specify the number of primaries in `CREATE DATABASE`, this value will be used unless overwritten by the `dbms.setDefaultAllocationNumbers` procedure.
|Valid values
a|An integer that is minimum `1` and is maximum `11`.
|Default value
m|+++1+++
|===


[role=label--enterprise-edition]
[[config_initial.dbms.default_secondaries_count]]
=== `initial.dbms.default_secondaries_count`

.initial.dbms.default_secondaries_count
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The initial default number of secondaries for the standard databases. Initialized at the first DBMS startup. If the user does not specify the number of secondaries in `CREATE DATABASE`, this value will be used unless overwritten by the `dbms.setDefaultAllocationNumbers` procedure.
|Valid values
a|An integer that is minimum `0` and is maximum `20`.
|Default value
m|+++0+++
|===

[role=label--enterprise-edition label--new-2025.12]
[[config_initial.dbms.default_property_shard_replica_count]]
=== `initial.dbms.default_property_shard_replica_count`

.initial.dbms.default_property_shard_replica_count
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The initial default number of replicas of property shards. Initialized at the first DBMS startup.
If the user does not specify the number replicas of property shards in `CREATE DATABASE`, this value will be used unless overwritten by the `dbms.setDefaultAllocationNumbers` procedure.
|Valid values
a|An integer that is minimum `1` and is maximum `20`.
|Default value
m|+++1+++
|===

[role=label--enterprise-edition]
[[config_initial.server.allowed_databases]]
=== `initial.server.allowed_databases`

.initial.server.allowed_databases
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|List of database names allowed on this server; all others are denied. Empty means all are allowed. This configuration is initialized at the first DBMS startup and/or when a newly added server is enabled. The setting is used as the default input for the `ENABLE SERVER` command; can be overriden when the command is executed. Exclusive with `server.initial_denied_databases`.
|Valid values
a|label:changed[Changed in 2025.12] A comma-separated set where each element is a valid database name pattern containing only alphabetic characters, numbers, dots, question marks, asterisks, and dashes with a length between 1 and 63 characters.
|Default value
m|++++++
|===


[role=label--enterprise-edition]
[[config_initial.server.denied_databases]]
=== `initial.server.denied_databases`

.initial.server.denied_databases
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|List of database names not allowed on this server. Empty means nothing is denied. This configuration is initialized at the first DBMS startup and/or when a newly added server is enabled. The setting is used as the default input for the `ENABLE SERVER` command; can be overriden when the command is executed. Exclusive with `server.initial_allowed_databases`.
|Valid values
a|label:changed[Changed in 2025.12] A comma-separated set where each element is a valid database name pattern containing only alphabetic characters, numbers, dots, question marks, asterisks, and dashes with a length between 1 and 63 characters.
|Default value
m|++++++
|===

In Neo4j 2025.12, valid values of the `initial.server.allowed_databases` and `initial.server.denied_databases` settings are updated.
Starting from 2025.12, database name patterns (wildcards) are supported, and the minimum number of characters is reduced from `3` to `1`.

[role=label--enterprise-edition]
[[config_initial.server.mode_constraint]]
=== `initial.server.mode_constraint`

.initial.server.mode_constraint
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Determines whether the server is configured to host primary databases only, secondary databases only, or both.
Initialized at the first DBMS startup and/or when a newly added server is enabled.
The setting is used as the default input for the `ENABLE SERVER` command; can be overriden when the command is executed.
|Valid values
a|One of [PRIMARY, SECONDARY, NONE].
|Default value
m|+++NONE+++
|===


[role=label--enterprise-edition]
[[config_initial.server.tags]]
=== `initial.server.tags`

.initial.server.tags
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of server tag names used by the database allocation and when configuring load balancing and replication policies. Initialized at the first DBMS startup and/or when a newly added server is enabled. The setting is used as the default input for the `ENABLE SERVER` command; can be overriden when the command is executed.
|Valid values
a|A comma-separated list where each element is a string identifying a server tag, which contains no duplicate items.
|Default value
m|++++++
|===


[role=label--enterprise-edition]
[[config_server.cluster.advertised_address]]
=== `server.cluster.advertised_address`

.server.cluster.advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Advertised hostname/IP address and port for the transaction shipping server.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port` that is an accessible address. If missing, it is acquired from server.default_advertised_address.
|Default value
m|+++:6000+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_server.cluster.catchup.connect_randomly_to_server_tags]]
=== `server.cluster.catchup.connect_randomly_to_server_tags`

.server.cluster.catchup.connect_randomly_to_server_tags
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Comma-separated list of tags to be used by the connect-randomly-to-server-with-tag selection strategy. The connect-randomly-to-server-with-tag strategy is used when the list of strategies (<<config_server.cluster.catchup.upstream_strategy,`server.cluster.catchup.upstream_strategy`>>) includes the value `connect-randomly-to-server-with-tag`.
|Valid values
a|A comma-separated list where each element is a string identifying a server tag.
|Default value
m|++++++
|===


[role=label--enterprise-edition]
[[config_server.cluster.catchup.upstream_strategy]]
=== `server.cluster.catchup.upstream_strategy`

.server.cluster.catchup.upstream_strategy
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A descending-ordered list of strategies secondaries use to choose the upstream server from which to pull transactional updates. If none are valid or the list is empty, the default strategy is `typically-connect-to-random-secondary`.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|++++++
|===


[role=label--enterprise-edition]
[[config_server.cluster.catchup.user_defined_upstream_strategy]]
=== `server.cluster.catchup.user_defined_upstream_strategy`

.server.cluster.catchup.user_defined_upstream_strategy
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configuration of a user-defined upstream selection strategy. The user-defined strategy is used when the list of strategies (<<config_server.cluster.catchup.upstream_strategy,`server.cluster.catchup.upstream_strategy`>>) includes the value `user_defined`.
|Valid values
a|A string.
|Default value
m|++++++
|===


[role=label--enterprise-edition]
[[config_server.cluster.listen_address]]
=== `server.cluster.listen_address`

.server.cluster.listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Network interface and port for the transaction shipping server to listen on. Note that it is also possible to run the backup client against this port, so always limit access to it via the firewall and configure an SSL policy.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from server.default_listen_address.
|Default value
m|+++:6000+++
|===


[role=label--enterprise-edition]
[[config_server.cluster.network.native_transport_enabled]]
=== `server.cluster.network.native_transport_enabled`

.server.cluster.network.native_transport_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Use native transport if available. Epoll for Linux or Kqueue for MacOS/BSD. If this setting is set to `false`, or if native transport is not available, Nio transport will be used.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_server.cluster.raft.advertised_address]]
=== `server.cluster.raft.advertised_address`

.server.cluster.raft.advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Advertised hostname/IP address and port for the RAFT server.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port` that is an accessible address. If missing, it is acquired from server.default_advertised_address.
|Default value
m|+++:7000+++
|===


[role=label--enterprise-edition]
[[config_server.cluster.raft.listen_address]]
=== `server.cluster.raft.listen_address`

.server.cluster.raft.listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Network interface and port for the RAFT server to listen on.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`. If missing, it is acquired from server.default_listen_address.
|Default value
m|+++:7000+++
|===


[role=label--enterprise-edition]
[[config_server.cluster.system_database_mode]]
=== `server.cluster.system_database_mode`

.server.cluster.system_database_mode
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Users must manually specify the mode for the system database on each server.
|Valid values
a|One of [PRIMARY, SECONDARY].
|Default value
m|+++PRIMARY+++
|===

