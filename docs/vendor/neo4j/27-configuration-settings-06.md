---
name: 27-configuration-settings-06
description: "Neo4j 2026.06.0 — Configuration settings reference (6/6): server directories, server, transaction, transaction log (27/60, config)"
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



== Server directories settings

The server directories settings can be used to change the default locations of your Neo4j files.
For more information, see xref:configuration/file-locations.adoc[Default file locations].


[role=label--enterprise-edition]
[[config_server.directories.cluster_state]]
=== `server.directories.cluster_state`

.server.directories.cluster_state
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Directory to hold cluster state including Raft log.
|Valid values
a|A path. If relative, it is resolved from server.directories.data.
|Default value
m|+++cluster-state+++
|===


[role=label--enterprise-edition label--new-2025.01]
[[config_server.directories.configuration]]
=== `server.directories.configuration`

.server.directories.configuration
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Root location of the configuration directory.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++conf+++
|===


[[config_server.directories.data]]
=== `server.directories.data`

.server.directories.data
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path of the data directory. You must not configure more than one Neo4j installation to use the same data directory.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++data+++
|===


[[config_server.directories.dumps.root]]
=== `server.directories.dumps.root`

.server.directories.dumps.root
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Root location where Neo4j will store database dumps optionally produced when dropping said databases.
|Valid values
a|A path. If relative, it is resolved from server.directories.data.
|Default value
m|+++dumps+++
|===


[[config_server.directories.import]]
=== `server.directories.import`

.server.directories.import
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Sets the root directory for file URLs used with the Cypher `LOAD CSV` clause. This should be set to a directory relative to the Neo4j installation path, restricting access to only those files within that directory and its subdirectories. For example the value "import" will only enable access to files within the 'import' folder. Removing this setting will disable the security feature, allowing all files in the local system to be imported. Setting this to an empty field will allow access to all files within the Neo4j installation folder.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|
|===


[[config_server.directories.lib]]
=== `server.directories.lib`

.server.directories.lib
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path of the lib directory.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++lib+++
|===


[[config_server.directories.licenses]]
=== `server.directories.licenses`

.server.directories.licenses
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path of the licenses directory.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++licenses+++
|===


[[config_server.directories.logs]]
=== `server.directories.logs`

.server.directories.logs
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path of the logs directory.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++logs+++
|===


[role=label--enterprise-edition]
[[config_server.directories.metrics]]
=== `server.directories.metrics`

.server.directories.metrics
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The target location of the CSV files: a path to a directory wherein a CSV file per reported field  will be written.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++metrics+++
|===


[[config_server.directories.neo4j_home]]
=== `server.directories.neo4j_home`

.server.directories.neo4j_home
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Root relative to which directory settings are resolved. Calculated and set by the server on startup. Defaults to the current working directory.
|Valid values
a|A path that is absolute.
|Default value
m|
|===


[[config_server.directories.plugins]]
=== `server.directories.plugins`

.server.directories.plugins
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Location of the database plugin directory. Compiled Java JAR files that contain database procedures will be loaded if they are placed in this directory.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++plugins+++
|===


[[config_server.directories.run]]
=== `server.directories.run`

.server.directories.run
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path of the run directory. This directory holds Neo4j's runtime state, such as a pidfile when it is running in the background. The pidfile is created when starting neo4j and removed when stopping it. It may be placed on an in-memory filesystem such as tmpfs.
|Valid values
a|A path. If relative, it is resolved from server.directories.neo4j_home.
|Default value
m|+++run+++
|===


[role=label--new-2026.04 label--enterprise-edition]
[[config_server.directories.seeds]]
=== `server.directories.seeds`

.server.directories.seeds
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path of the seeds directory
|Valid values
a|A path. If relative, it is resolved from `server.directories.neo4j_home`.
|Default value
m|+++seeds+++
|===


[[config_server.directories.script.root]]
=== `server.directories.script.root`

.server.directories.script.root
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Root location where Neo4j will store scripts for configured databases.
|Valid values
a|A path. If relative, it is resolved from server.directories.data.
|Default value
m|+++scripts+++
|===


[[config_server.directories.transaction.logs.root]]
===  `server.directories.transaction.logs.root`

.server.directories.transaction.logs.root
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Root location where Neo4j will store transaction logs for configured databases.
|Valid values
a|A path. If relative, it is resolved from server.directories.data.
|Default value
m|+++transactions+++
|===


== Server settings

Server settings apply only to the specific server and can be varied between configuration files across a cluster/DBMS.


[role=label--enterprise-edition]
[[config_server.backup.enabled]]
=== `server.backup.enabled`

.server.backup.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable support for running online backups.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_server.backup.exec_connector.command]]
=== `server.backup.exec_connector.command`

.server.backup.exec_connector.command
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Command to execute for ExecDataConnector list
|Valid values
a|A string.
|Default value
m|++++++
|===


[[config_server.backup.exec_connector.command_timeout]]


[role=label--enterprise-edition]
[[config_server.backup.exec_connector.scheme]]
=== `server.backup.exec_connector.scheme`

.server.backup.exec_connector.scheme
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Schemes ExecDataConnector will match on
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|
|===


[[config_server.backup.exec_connector.tls_ca]]


[role=label--enterprise-edition]
[[config_server.backup.listen_address]]
=== `server.backup.listen_address`

.server.backup.listen_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Network interface and port for the backup server to listen on.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port`.
|Default value
m|+++127.0.0.1:6362+++
|===


[role=label--enterprise-edition label--new-2025.05]
[[config_server.backup.advertised_address]]
=== `server.backup.advertised_address`

.server.backup.advertised_address
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The advertised address for the backup server. Default is the default advertised address combined with port defined in the backup listen address.
|Valid values
a|A socket address in the format of `hostname:port`, `hostname`, or `:port` that is an accessible address. If missing, it is acquired from `server.default_advertised_address`.
|Default value
m|+++:0+++
|===



[role=label--enterprise-edition]
[[config_server.backup.store_copy_max_retry_time_per_request]]
=== `server.backup.store_copy_max_retry_time_per_request`

.server.backup.store_copy_max_retry_time_per_request
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum retry time per request during store copy. Regular store files and indexes are downloaded in separate requests during store copy. This configures the maximum time failed requests are allowed to resend.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++20m+++
|===


[[config_server.config.strict_validation.enabled]]
=== `server.config.strict_validation.enabled`

.server.config.strict_validation.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A strict configuration validation will prevent the database from starting up if unknown configuration options are specified in the neo4j settings namespace (such as dbms., cypher., etc) or if settings are declared multiple times.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--dynamic]
[[config_server.databases.default_to_read_only]]
=== `server.databases.default_to_read_only`

.server.databases.default_to_read_only
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Whether or not any database on this instance is read_only by default. If `false`, individual databases may be marked as read_only using server.database.read_only. If `true`, individual databases may be marked as writable using <<config_server.databases.writable,`server.databases.writable`>>.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--dynamic]
[[config_server.databases.read_only]]
=== `server.databases.read_only`

.server.databases.read_only
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|List of databases for which to prevent write queries. Databases not included in this list maybe read_only anyway depending upon the value of <<config_server.databases.default_to_read_only,`server.databases.default_to_read_only`>>.
|Valid values
a| A comma-separated set where each element is a valid database name containing only alphabetic characters, numbers, dots, and dashes with a length between 3 and 63 characters, starting with an alphabetic character or number but not with the name system.
|Default value
m|++++++
|===


[role=label--dynamic]
[[config_server.databases.writable]]
=== `server.databases.writable`

.server.databases.writable
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|List of databases for which to allow write queries. Databases not included in this list will allow write queries anyway, unless <<config_server.databases.default_to_read_only,`server.databases.default_to_read_only`>> is set to `true`.
|Valid values
a|A comma-separated set where each element is a valid database name containing only alphabetic characters, numbers, dots, and dashes with a length between 3 and 63 characters, starting with an alphabetic character or number but not with the name system.
|Default value
m|++++++
|===


[role=label--enterprise-edition]
[[config_server.dynamic.setting.allowlist]]
=== `server.dynamic.setting.allowlist`

.server.dynamic.setting.allowlist
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of setting name patterns (comma separated) that are allowed to be dynamically changed. The list may contain both full setting names, and partial names with the wildcard `*`. If this setting is left empty all dynamic settings updates will be blocked.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|+++*+++
|===


[[config_server.jvm.additional]]
=== `server.jvm.additional`

.server.jvm.additional
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Additional JVM arguments. Argument order can be significant. To use a Java commercial feature, the argument to unlock commercial features must precede the argument to enable the specific feature in the config value string.
|Valid values
a|One or more jvm arguments.
|Default value
m|
|===

For details about the default values of `server.jvm.additional`, see xref:configuration/neo4j-conf.adoc#default-values-server.jvm.additional[The _neo4j.conf_ file -> Default values of `server.jvm.additional`].

[role=label--enterprise-edition]
[[config_server.panic.shutdown_on_panic]]
=== `server.panic.shutdown_on_panic`

.server.panic.shutdown_on_panic
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Controls whether the Neo4j process will shut down, if there is a server panic (an unrecoverable error), or continue running. Following a server panic, it is likely that a significant amount of functionality will be lost. Recovering full functionality will require restarting the Neo4j process.
|Valid values
a|A boolean.
|Default value
m|+++true+++ label:changed[Changed in 2025.01]
|===


[[config_server.threads.worker_count]]
=== `server.threads.worker_count`

.server.threads.worker_count
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Number of Neo4j worker threads. This setting is only valid for REST and does not influence bolt-server. It sets the number of worker threads for the Jetty server used by neo4j-server. This option can be tuned when you plan to execute multiple, concurrent REST requests, to get more throughput from the database. Your OS might enforce a lower limit than the maximum value specified here. Number of available processors, or 500 for machines that have more than 500 processors.
|Valid values
a|An integer that is in the range `1` to `44738`.
|Default value
m|
|===


[[config_server.unmanaged_extension_classes]]
=== `server.unmanaged_extension_classes`

.server.unmanaged_extension_classes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Comma-separated list of <classname>=<mount point> for unmanaged extensions.
|Valid values
a|A comma-separated list where each element is `<classname>=<mount point>` string.
|Default value
m|++++++
|===


[[config_server.windows_service_name]]
=== `server.windows_service_name`

.server.windows_service_name
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Name of the Windows Service managing Neo4j when installed using `neo4j install-service`. Only applicable on Windows OS. +
NOTE: This must be unique for each installation.
|Valid values
a|A string.
|Default value
m|+++neo4j+++
|===



== Transaction settings

The transaction settings helps you manage the transactions in your database, for example, the transaction timeout, the lock acquisition timeout, the maximum number of concurrently running transactions, etc.
For more information, see xref:/database-internals/transaction-management.adoc[Manage transactions] and xref:/database-internals/concurrent-data-access.adoc[Concurrent data access].


[role=label--dynamic]
[[config_db.lock.acquisition.timeout]]
=== `db.lock.acquisition.timeout`

.db.lock.acquisition.timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum time interval within which lock should be acquired. Zero (default) means the timeout is disabled.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++0s+++
|===


[[config_db.shutdown_transaction_end_timeout]]
=== `db.shutdown_transaction_end_timeout`

.db.shutdown_transaction_end_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum amount of time to wait for running transactions to complete before allowing initiated database shutdown to continue.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++10s+++
|===


[role=label--dynamic]
[[config_db.transaction.bookmark_ready_timeout]]
=== `db.transaction.bookmark_ready_timeout`

.db.transaction.bookmark_ready_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum amount of time to wait for the database state represented by the bookmark.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`) that is minimum `1s`.
|Default value
m|+++30s+++
|===


[role=label--dynamic]
[[config_db.transaction.concurrent.maximum]]
=== `db.transaction.concurrent.maximum`

.db.transaction.concurrent.maximum
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of concurrently running transactions. If set to 0, the limit is disabled.
|Valid values
a|An integer.
|Default value
m|+++1000+++
|===


[[config_db.transaction.monitor.check.interval]]
=== `db.transaction.monitor.check.interval`

.db.transaction.monitor.check.interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Configures the time interval between transaction monitor checks. Determines how often the monitor thread will check a transaction for timeout.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++2s+++
|===


[role=label--dynamic]
[[config_db.transaction.sampling.percentage]]
=== `db.transaction.sampling.percentage`

.db.transaction.sampling.percentage
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Transaction sampling percentage.
|Valid values
a|An integer that is in the range `1` to `100`.
|Default value
m|+++5+++
|===


[role=label--dynamic]
[[config_db.transaction.timeout]]
=== `db.transaction.timeout`

.db.transaction.timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum time interval of a transaction within which it should be completed.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++0s+++
|===


[role=label--dynamic]
[[config_db.transaction.tracing.level]]
=== `db.transaction.tracing.level`

.db.transaction.tracing.level
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Transaction creation tracing level.
|Valid values
a|One of [DISABLED, SAMPLE, ALL].
|Default value
m|+++DISABLED+++
|===


[[config_server.http.transaction_idle_timeout]]
=== `server.http.transaction_idle_timeout`

.server.http.transaction_idle_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Timeout for idle transactions in the HTTP Server. +
NOTE: This is different from 'db.transaction.timeout' which will timeout the underlying transaction.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++30s+++
|===


[[config_server.queryapi.transaction_idle_timeout]]
=== `server.queryapi.transaction_idle_timeout`

.server.queryapi.transaction_idle_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Timeout for idle transactions in the Query API. +
Note: this is different from 'db.transaction.timeout' which will timeout the underlying transaction.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++1m+++
|===




== Transaction log settings

Transaction logs keep the list of transactions that have not yet been applied to the store files.
This is necessary for recovery.
The following settings configure the number of transaction logs left after a pruning operation and the size of the transaction log files.

See also <<Checkpoint settings>>.


[[config_db.recovery.fail_on_missing_files]]
=== `db.recovery.fail_on_missing_files`

.db.recovery.fail_on_missing_files
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|If `true`, Neo4j will abort recovery if transaction log files are missing. Setting this to `false` will allow Neo4j to create new empty missing files for the already existing database, but the integrity of the database might be compromised.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_db.tx_log.buffer.size]]
=== `db.tx_log.buffer.size`

.db.tx_log.buffer.size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|On serialization of transaction logs, they will be temporary stored in the byte buffer that will be flushed at the end of the transaction or at any moment when the buffer will be full.
By default, the size of the byte buffer is based on the number of available CPU's with a minimal buffer size of 512KB. Every other 4 CPU's will add another 512KB into the buffer size. The maximal buffer size in this default scheme is 4MB taking into account that you can have one transaction log writer per database in multi-database env. For example, runtime with 4 CPUs will have the buffer size of 1MB; runtime with 8 CPUs will have the buffer size of 1MB 512KB; runtime with 12 CPUs will have the buffer size of 2MB.
|Valid values
a|A long that is minimum `131072`.
|Default value
m|
|===


[role=label--dynamic]
[[config_db.tx_log.preallocate]]
=== `db.tx_log.preallocate`

.db.tx_log.preallocate
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Specify if Neo4j should try to preallocate the logical log file in advance.
It optimizes file system by ensuring there is room to accommodate newly generated files and avoid file-level fragmentation.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--dynamic]
[[config_db.tx_log.rotation.retention_policy]]
=== `db.tx_log.rotation.retention_policy`

.db.tx_log.rotation.retention_policy
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Specify how long Neo4j should keep logical transaction logs to backup the database.
For example, `10 days` prunes logical logs that only contain transactions older than 10 days.
Alternatively, `100k txs` keeps the 100k latest transactions from each database and prunes any older transactions.
You can optionally add a period-based restriction to the size of logs to keep.
For example, `2 days 1G` prunes logical logs that only contain transactions older than 2 days or are larger than 1G.
|Valid values
a|label:changed[Changed in 2026.04] A string that matches the pattern `^(true\|keep_all\|false\|keep_none\|backup( \d+[KkMmGg]?)?( \d+[KkMmGg]?)?\|(\d+[KkMmGg]?( (files\|size\|txs\|entries\|hours( \d+[KkMmGg]?)?\|days( \d+[KkMmGg]?)?))))$` (Must be `true` or `keep_all`, `false` or `keep_none`, or of format `<number><optional unit> <type> <optional space restriction>`. Valid units are `K`, `M` and `G`. Valid types are `files`, `size`, `txs`, `entries`, `hours` and `days`. Valid optional space restriction is a logical log space restriction like `100M`. For example, `100M size` will limit logical log space on disk to 100MiB per database, and `200K txs` will limit the number of transactions kept to 200 000 per database.).
|Default value
m|+++2 days 2G+++
|===

[NOTE]
====
When using a period-based restriction with size of logs to keep, add only the period type, for example, `2 days 2G`.
Additionally, in this case, only `hours` and `days` are allowed, for example, `2 years 100G` is not allowed.
====

[role=label--dynamic]
[[config_db.tx_log.rotation.size]]
=== `db.tx_log.rotation.size`

.db.tx_log.rotation.size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Specifies at which file size the logical log will auto-rotate. The minimum accepted value is 128 KiB.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`) that is minimum `128.00KiB`.
|Default value
m|+++256.00MiB+++
|===
