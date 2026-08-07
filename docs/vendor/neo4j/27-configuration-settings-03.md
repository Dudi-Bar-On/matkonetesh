---
name: 27-configuration-settings-03
description: "Neo4j 2026.06.0 — Configuration settings reference (3/6): database, DBMS, fleet manager, import, index, logging, memory (24/60, config)"
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



== Database settings

Database settings affect the behavior of a Neo4j database, for example, the file watcher service, the database format, the database store files, and the database timezone.
They can be varied between each database but must be consistent across all configuration files in a cluster/DBMS.

[[config_db.filewatcher.enabled]]
=== `db.filewatcher.enabled`

.db.filewatcher.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Allows the enabling or disabling of the file watcher service. This is an auxiliary service but should be left enabled in almost all cases.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--dynamic]
[[config_db.format]]
=== `db.format`

.db.format
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Database format. This is the format that will be used for new databases. Valid values are `standard`, `aligned`, `high_limit` or `block`.
The `aligned` format is essentially the `standard` format with some minimal padding at the end of pages such that a single record will never cross a page boundary.
The `high_limit` and `block` formats are available for Enterprise Edition only.
Either `high_limit` or `block` is required if you have a graph that is larger than 34 billion nodes, 34 billion relationships, or 68 billion properties.
|Valid values
a|A string.
|Default value
m|+++block+++
|===


[NOTE]
====
`standard` and `high_limit` formats are deprecated in Neo4j 5.23.
====


[[config_db.relationship_grouping_threshold]]
=== `db.relationship_grouping_threshold`

.db.relationship_grouping_threshold
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Relationship count threshold for considering a node to be dense. This setting applies only to `standard`, `aligned`, and `high_limit` formats.
|Valid values
a|An integer that is minimum `1`.
|Default value
m|+++50+++
|===


[[config_db.store.files.preallocate]]
=== `db.store.files.preallocate`

.db.store.files.preallocate
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Specify if Neo4j should try to preallocate store files as they grow.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_db.temporal.timezone]]
=== `db.temporal.timezone`

.db.temporal.timezone
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Database timezone for temporal functions. All Time and DateTime values that are created without an explicit timezone will use this configured default timezone.
|Valid values
a|A string describing a timezone, either described by offset (e.g. `+02:00`) or by name (e.g. `Europe/Stockholm`).
|Default value
m|+++Z+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_db.track_query_cpu_time]]
=== `db.track_query_cpu_time`

.db.track_query_cpu_time
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enables or disables tracking of how much time a query spends actively executing on the CPU. Calling `SHOW TRANSACTIONS` will display the time, but not in the _query.log_. +
If you want the CPU time to be logged in the _query.log_, set `db.track_query_cpu_time=true`.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===



== DBMS settings

The DBMS settings affect the Neo4j DBMS as a whole.
You can use them to set the default database, the DBMS timezone, a list of seed providers, and the maximum number of databases.
The DBMS settings must be consistent across all configuration files in a cluster/DBMS.


[[config_initial.dbms.default_database]]
=== `initial.dbms.default_database`

.initial.dbms.default_database
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Specifies the default database name *before* the first DBMS startup.
After the initial default database is created, changing this setting has no effect.
To change the default database, use the xref:/clustering/databases.adoc#cluster-default-database[`dbms.setDefaultDatabase()`] procedure instead.

NOTE: This setting is not the same as `dbms.default_database`, which was used to set the default database in Neo4j 4.x and earlier versions.
|Valid values
a|A valid database name containing only alphabetic characters, numbers, dots, and dashes with a length between 3 and 63 characters, starting with an alphabetic character or number but not with the name system.
|Default value
m|+++neo4j+++
|===


[[config_dbms.db.timezone]]
=== `dbms.db.timezone`

.dbms.db.timezone
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Database timezone. Among other things, this setting influences the monitoring procedures.
|Valid values
a|One of [UTC, SYSTEM].
|Default value
m|+++UTC+++
|===


[role=label--enterprise-edition]
[[config_dbms.databases.seed_from_uri_providers]]
=== `dbms.databases.seed_from_uri_providers`

.dbms.databases.seed_from_uri_providers
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Databases can be created from an existing _seed_ (a database backup or dump) stored at a specific source URI.
Different implementations of `com.neo4j.dbms.seeding.SeedProvider` support various types of seed sources.

The following values are available: `CloudSeedProvider`, `FileSeedProvider`, `S3SeedProvider`, `URLConnectionSeedProvider`, and `ServerSeedProvider`.

* `CloudSeedProvider` supports seeds addressed with  `s3`, `azb`, `gs`.
* `FileSeedProvider` supports seeds addressed with `file`.
* `S3SeedProvider` supports seeds addressed with  `s3` but is deprecated and only usable in Cypher 5.
* `URLConnectionSeedProvider` supports seeds addressed with `ftp`,`http`, and `https`.
* `ServerSeedProvider` supports seeds addressed with `server`.


This list specifies enabled seed providers.
If a seed source (URI scheme) is supported by multiple providers in the list, the first matching provider will be used.
If the list is set to empty, the seed from URI functionality is effectively disabled.
See xref::database-administration/standard-databases/seed-from-uri.adoc[Seed from a URI] for more information.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|+++CloudSeedProvider+++ label:changed[Changed in 2025.01]
|===

In 2025.01, the default value of `dbms.databases.seed_from_uri_providers` was changed from `S3SeedProvider,CloudSeedProvider` to `CloudSeedProvider`.

In 2026.04, `ServerSeedProvider` is introduced.

[role=label--enterprise-edition]
[[config_dbms.max_databases]]
=== `dbms.max_databases`

.dbms.max_databases
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of databases.
|Valid values
a|A long that is minimum `2`.
|Default value
m|+++100+++
|===


[[config_dbms.usage_report.enabled]]
=== `dbms.usage_report.enabled`

.dbms.usage_report.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Usage data reporting.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


== Fleet Manager settings

[role=label--new-2025.11]
[[config_dbms.fleet_manager.enabled]]
=== `dbms.fleet_manager.enabled`

.dbms.fleet_manager.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable Fleet Manager functionality for monitoring with Neo4j Aura.
|Valid values
a|A boolean.
|Default value
m|+++true+++ label:changed[Changed in 2026.03]
|===

[NOTE]
====
Starting with 2026.03, Fleet Manager is built-in and enabled by default, so there is no need to download and install the plugin separately.
====


[role=label--new-2026.05]
[[config_server.fleet_discovery.broadcast_interval]]
=== `server.fleet_discovery.broadcast_interval`

.server.fleet_discovery.broadcast_interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The interval at which discovery broadcasts occur (base value to be adjusted by jitter interval).
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s) that is minimum 5s.
|Default value
m|+++30s+++
|===


[role=label--new-2026.05]
[[config_server.fleet_discovery.broadcast_interval_jitter]]
=== `server.fleet_discovery.broadcast_interval_jitter`

.server.fleet_discovery.broadcast_interval_jitter
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The jitter to apply to the broadcast interval in percent (e.g. when set to 50 with broadcast interval of 30 then broadcasts repeat every 15 to 45 seconds).
|Valid values
a|An integer that is minimum 0 and is maximum 75.
|Default value
m|+++25+++
|===


[role=label--new-2026.05]
[[config_server.fleet_discovery.enabled]]
=== `server.fleet_discovery.enabled`

.server.fleet_discovery.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enables fleet discovery on this server.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--new-2026.05]
[[config_server.fleet_discovery.port]]
=== `server.fleet_discovery.port`

.server.fleet_discovery.port
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The port to listen for fleet discovery communication on (when set to zero a random port is bound).
|Valid values
a|An integer that is minimum 0.
|Default value
m|+++0+++
|===



== Import settings

The import settings control the size of the internal buffer used by `LOAD CSV` and the escaping of quotes in CSV files.


[[config_db.import.csv.buffer_size]]
=== `db.import.csv.buffer_size`

.db.import.csv.buffer_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The size of the internal buffer in bytes used by `LOAD CSV`. If the csv file contains huge fields this value may have to be increased.
|Valid values
a|A long that is minimum `1`.
|Default value
m|+++2097152+++
|===


[[config_db.import.csv.legacy_quote_escaping]]
=== `db.import.csv.legacy_quote_escaping`

.db.import.csv.legacy_quote_escaping
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Selects whether to conform to the standard https://datatracker.ietf.org/doc/html/rfc4180 for interpreting escaped quotation characters in CSV files loaded using `LOAD CSV`. Setting this to `false` will use the standard, interpreting repeated quotes '""' as a single in-lined quote, while `true` will use the legacy convention originally supported in Neo4j 3.0 and 3.1, allowing a backslash to include quotes in-lined in fields.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===



== Index settings

The index settings control the full-text index and the background index sampling (chunk size limit and sample size).
For more information, see xref:/performance/index-configuration.adoc[Index configuration].


[[config_db.index.fulltext.default_analyzer]]
=== `db.index.fulltext.default_analyzer`

.db.index.fulltext.default_analyzer
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The name of the analyzer that the full-text indexes should use by default.
|Valid values
a|A string.
|Default value
m|+++standard-no-stop-words+++
|===


[[config_db.index.fulltext.eventually_consistent]]
=== `db.index.fulltext.eventually_consistent`

.db.index.fulltext.eventually_consistent
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Whether or not full-text indexes should be eventually consistent by default or not.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===



[[config_db.index.fulltext.eventually_consistent_apply_parallelism]]
=== `db.index.fulltext.eventually_consistent_apply_parallelism`

.db.index.fulltext.eventually_consistent_apply_parallelism
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The number of threads processing queued index updates for eventually consistent full-text indexes.
|Valid values
a|An integer that is minimum 1.
|Default value
m|+++1+++
|===


[[config_db.index.fulltext.eventually_consistent_refresh_interval]]
=== `db.index.fulltext.eventually_consistent_refresh_interval`

.db.index.fulltext.eventually_consistent_refresh_interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|How often an eventually consistent full-text index is refreshed (changes are guaranteed to be visible). If set to `0`, refresh is done by the threads applying eventually consistent full-text index updates.
|Valid values
a|A duration (Valid units are: ns, μs, ms, s, m, h and d; default unit is s).
|Default value
m|+++0s+++
|===


[[config_db.index.fulltext.eventually_consistent_refresh_parallelism]]
=== `db.index.fulltext.eventually_consistent_refresh_parallelism`

.db.index.fulltext.eventually_consistent_refresh_parallelism
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The number of threads that can do full-text index refresh in parallel, i.e. the number of eventually consistent full-text indexes that can be refreshed in parallel.
|Valid values
a|An integer that is minimum 1.
|Default value
m|+++1+++
|===


[[config_db.index.fulltext.eventually_consistent_index_update_queue_max_length]]
=== `db.index.fulltext.eventually_consistent_index_update_queue_max_length`

.db.index.fulltext.eventually_consistent_index_update_queue_max_length
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The _eventually consistent_ mode of the full-text indexes works by queueing up index updates to be applied later in a background thread. This newBuilder sets an upper bound on how many index updates are allowed to be in this queue at any one point in time. When it is reached, the commit process will slow down and wait for the index update applier thread to make some more room in the queue.
|Valid values
a|An integer that is in the range `1` to `50000000`.
|Default value
m|+++10000+++
|===


[[config_db.index_sampling.background_enabled]]
=== `db.index_sampling.background_enabled`

.db.index_sampling.background_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable or disable background index sampling.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_db.index_sampling.sample_size_limit]]
=== `db.index_sampling.sample_size_limit`

.db.index_sampling.sample_size_limit
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Index sampling chunk size limit.
|Valid values
a|An integer that is in the range `1048576` to `2147483647`.
|Default value
m|+++8388608+++
|===


[[config_db.index_sampling.update_percentage]]
=== `db.index_sampling.update_percentage`

.db.index_sampling.update_percentage
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Percentage of index updates of total index size required before sampling of a given index is triggered.
|Valid values
a|An integer that is minimum `0`.
|Default value
m|+++5+++
|===



== Logging settings

Neo4j has two different configuration files for logging, one for the _neo4j.log_, which contains general information about Neo4j, and one configuration file for all other types of logging via Log4j 2 (except _gc.log_ which is handled by the Java Virtual Machine(JVM).
For more information, see xref:/monitoring/logging.adoc[Logging].


[role=label--dynamic]
[[config_db.logs.query.annotation_data_format]]
=== `db.logs.query.annotation_data_format`

.db.logs.query.annotation_data_format
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The format to use for the JSON annotation data.

`CYPHER`:: Formatted as a Cypher map. E.g. `{foo: 'bar', baz: {k: 1}}`.
`JSON`:: Formatted as a JSON map. E.g. `{"foo": "bar", "baz": {"k": 1}}`.
`FLAT_JSON`:: Formatted as a flattened JSON map. E.g. `{"foo": "bar", "baz.k": 1}`.

This only have effect when the query log is in JSON format.
|Valid values
a|One of [CYPHER, JSON, FLAT_JSON].
|Default value
m|+++JSON+++ label:changed[Changed in 2025.01]
|===


[role=label--dynamic]
[[config_db.logs.query.early_raw_logging_enabled]]
=== `db.logs.query.early_raw_logging_enabled`

.db.logs.query.early_raw_logging_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Log query text and parameters without obfuscating passwords. This allows queries to be logged earlier before parsing starts.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--dynamic]
[[config_db.logs.query.enabled]]
=== `db.logs.query.enabled`

.db.logs.query.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Log executed queries. Valid values are `OFF`, `INFO`, or `VERBOSE`.

`OFF`::  no logging.
`INFO`:: log queries at the end of execution, that take longer than the configured threshold, <<config_db.logs.query.threshold,`db.logs.query.threshold`>>.
`VERBOSE`:: log queries at the start and end of execution, regardless of <<config_db.logs.query.threshold,`db.logs.query.threshold`>>.

Log entries are written to the query log.

This feature is available in the Neo4j Enterprise Edition.
|Valid values
a|One of [OFF, INFO, VERBOSE].
|Default value
m|+++VERBOSE+++
|===


[role=label--dynamic]
[[config_db.logs.query.max_parameter_length]]
=== `db.logs.query.max_parameter_length`

.db.logs.query.max_parameter_length
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Sets a maximum character length use for each parameter in the log. This only takes effect if <<config_db.logs.query.parameter_logging_enabled,`db.logs.query.parameter_logging_enabled`>> = `true`.
|Valid values
a|An integer.
|Default value
m|+++2147483647+++
|===


[role=label--new-2026.01.3 label--dynamic]
[[config_db.logs.query.obfuscate_errors]]
=== `db.logs.query.obfuscate_errors`

.db.logs.query.obfuscate_errors
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|If true, obfuscates all error information that can contain sensitive data before writing it to the query log. This applies to `failureReason` and `statusDescription` fields when the query log uses JSON format and error messages otherwise. It is recommended to set this setting to `true` in production.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--dynamic]
[[config_db.logs.query.obfuscate_literals]]
=== `db.logs.query.obfuscate_literals`

.db.logs.query.obfuscate_literals
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|If true, obfuscates all literals in a query before writing the query to the query log. Note that node labels, relationship types, and map property keys remain visible. Changing the setting will not affect queries that are cached. To apply the change immediately, you must also call `CALL db.clearQueryCaches()`. It is recommended to set this setting to `true` in production.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===

[NOTE]
====
Keep in mind that if Neo4j receives a malformed query that cannot be parsed, it cannot obfuscate its literals (because it does not know which parts are literals) and, therefore, the query text will not be included in any logging.
====

[role=label--dynamic]
[[config_db.logs.query.parameter_logging_enabled]]
=== `db.logs.query.parameter_logging_enabled`

.db.logs.query.parameter_logging_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Log parameters for the executed queries being logged.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--dynamic]
[[config_db.logs.query.plan_description_enabled]]
=== `db.logs.query.plan_description_enabled`

.db.logs.query.plan_description_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Log query plan description table, useful for debugging purposes.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--dynamic]
[[config_db.logs.query.threshold]]
=== `db.logs.query.threshold`

.db.logs.query.threshold
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|If the execution of a query takes more time than this threshold, the query is logged once completed - provided query logging is set to INFO. Defaults to 0 seconds, that is all queries are logged.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++0s+++
|===


[role=label--dynamic label--enterprise-edition]
[[config_db.logs.query.transaction.enabled]]
=== `db.logs.query.transaction.enabled`

.db.logs.query.transaction.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Log the start and end of a transaction. Valid values are 'OFF', 'INFO', or 'VERBOSE'.
OFF:  no logging.
INFO: log the start and end of transactions that take longer than the configured threshold, <<config_db.logs.query.transaction.threshold,`db.logs.query.transaction.threshold`>>.
VERBOSE: log the start and end of all transactions.
Log entries are written to the query log.
|Valid values
a|One of [OFF, INFO, VERBOSE].
|Default value
m|+++OFF+++
|===


[role=label--dynamic]
[[config_db.logs.query.transaction.threshold]]
=== `db.logs.query.transaction.threshold`

.db.logs.query.transaction.threshold
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|If the transaction is open for more time than this threshold, the transaction is logged once completed - provided transaction logging (<<config_db.logs.query.transaction.enabled,`db.logs.query.transaction.enabled`>>) is set to `INFO`. Defaults to 0 seconds (all transactions are logged).
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++0s+++
|===


[[config_dbms.logs.http.enabled]]
=== `dbms.logs.http.enabled`

.dbms.logs.http.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable HTTP request logging.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--changed-2025.01]
[[config_server.logs.config]]
=== `server.logs.config`

.server.logs.config
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path to the logging configuration for debug, query, http and security logs.
|Valid values
a|A path. If relative, it is resolved from server.directories.configuration.
|Default value
m|+++server-logs.xml+++
|===


[[config_server.logs.debug.enabled]]
=== `server.logs.debug.enabled`

.server.logs.debug.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable the debug log.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_server.logs.gc.enabled]]
=== `server.logs.gc.enabled`

.server.logs.gc.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable GC Logging.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_server.logs.gc.options]]
=== `server.logs.gc.options`

.server.logs.gc.options
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|GC Logging Options.
|Valid values
a|A string.
|Default value
m|+++-Xlog:gc*,safepoint,age*=trace+++
|===


[[config_server.logs.gc.rotation.keep_number]]
=== `server.logs.gc.rotation.keep_number`

.server.logs.gc.rotation.keep_number
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Number of GC logs to keep.
|Valid values
a|An integer.
|Default value
m|+++5+++
|===


[[config_server.logs.gc.rotation.size]]
=== `server.logs.gc.rotation.size`

.server.logs.gc.rotation.size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Size of each GC log that is kept.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|+++20.00MiB+++
|===


[role=label--changed-2025.01]
[[config_server.logs.user.config]]
=== `server.logs.user.config`

.server.logs.user.config
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Path to the logging configuration of user logs.
|Valid values
a|A path. If relative, it is resolved from server.directories.configuration.
|Default value
m|+++user-logs.xml+++
|===



== Memory settings

Memory settings control how much memory is allocated to Neo4j and how it is used.
It is recommended to perform a certain amount of testing and tuning of these settings to figure out the optimal division of the available memory.
For more information on how to tune these settings, see xref:/performance/memory-configuration.adoc[Memory configuration], xref:/performance/disks-ram-and-other-tips.adoc[Disks, RAM and other tips], and xref:performance/gc-tuning.adoc[Tuning of the garbage collector].


[[config_db.memory.pagecache.warmup.enable]]
=== `db.memory.pagecache.warmup.enable`

.db.memory.pagecache.warmup.enable
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Page cache can be configured to perform usage sampling of loaded pages that can be used to construct active load profile. According to that profile pages can be reloaded on the restart, replication, etc. This setting allows disabling that behavior.
This feature is available in Neo4j Enterprise Edition.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--new-2026.03]
[[config_db.memory.pagecache.warmup.order]]
=== `db.memory.pagecache.warmup.order`

.db.memory.pagecache.warmup.order
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Order in which page cache files will be warmed up in accordance with profiles.
|Valid values
a|One of [NONE, ALPHABETIC, PRIORITY].
|Default value
m|+++NONE+++
|===



[[config_db.memory.pagecache.warmup.preload]]
=== `db.memory.pagecache.warmup.preload`

.db.memory.pagecache.warmup.preload
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Page cache warmup can be configured to prefetch files, preferably when cache size is bigger than store size. Files to be prefetched can be filtered by 'dbms.memory.pagecache.warmup.preload.allowlist'. Enabling this disables warmup by profile.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[[config_db.memory.pagecache.warmup.preload.allowlist]]
=== `db.memory.pagecache.warmup.preload.allowlist`

.db.memory.pagecache.warmup.preload.allowlist
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Page cache warmup prefetch file allowlist regex. By default matches all files.
|Valid values
a|A string.
|Default value
m|.*
|===


[role=label--enterprise-edition]
[[config_db.memory.pagecache.warmup.profile.interval]]
=== `db.memory.pagecache.warmup.profile.interval`

.db.memory.pagecache.warmup.profile.interval
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The profiling frequency for the page cache. Accurate profiles allow the page cache to do an active warmup after a restart, reducing the mean time to performance.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++1m+++
|===


[role=label--dynamic]
[[config_db.memory.transaction.max]]
=== `db.memory.transaction.max`

.db.memory.transaction.max
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Limit the amount of memory that a single transaction can consume, in bytes (or kilobytes with the 'k' suffix, megabytes with 'm', and gigabytes with 'g'). Zero means 'largest possible value'.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`) that is minimum `1.00MiB` or is `0B`.
|Default value
m|+++0B+++
|===


[role=label--dynamic]
[[config_db.memory.transaction.total.max]]
=== `db.memory.transaction.total.max`

.db.memory.transaction.total.max
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Limit the amount of memory that all transactions in one database can consume, in bytes (or kilobytes with the 'k' suffix, megabytes with 'm' and gigabytes with 'g'). Zero means 'unlimited'.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`) that is minimum `10.00MiB` or is `0B`.
|Default value
m|+++0B+++
|===



[role=label--deprecated-5.7]
[[config_server.db.query_cache_size]]
=== `server.db.query_cache_size`

.server.db.query_cache_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The number of cached Cypher query execution plans per database. The max number of query plans that can be kept in cache is the `number of databases` * ``server.db.query_cache_size``. With 10 databases and ``server.db.query_cache_size``=1000, the caches can keep 10000 plans in total on the instance, assuming that each DB receives queries that fill up its cache.
|Valid values
a|An integer that is minimum `0`.
|Default value
m|+++1000+++
|Replaced by
a|<<config_server.memory.query_cache.per_db_cache_num_entries,`server.memory.query_cache.per_db_cache_num_entries`>>
|===


[[config_dbms.memory.tracking.enable]]
=== `dbms.memory.tracking.enable`

.dbms.memory.tracking.enable
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable off heap and on heap memory tracking. Should not be set to `false` for clusters.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--dynamic]
[[config_dbms.memory.transaction.total.max]]
=== `dbms.memory.transaction.total.max`

.dbms.memory.transaction.total.max
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Limit the amount of memory that all of the running transactions can consume, in bytes (or kilobytes with the 'k' suffix, megabytes with 'm' and gigabytes with 'g'). Zero means 'unlimited'. Defaults to 70% of the heap size limit.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`) that is minimum `10.00MiB` or is `0B`.
|Default value
m|
|===


[[config_server.memory.heap.initial_size]]
=== `server.memory.heap.initial_size`

.server.memory.heap.initial_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Initial heap size. By default it is calculated based on available system resources.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|
|===


[[config_server.memory.heap.max_size]]
=== `server.memory.heap.max_size`

.server.memory.heap.max_size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Maximum heap size. By default it is calculated based on available system resources.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|
|===


[role=label--new-2026.04]
[[config_server.memory.pagecache.async]]
=== `server.memory.pagecache.async`

.server.memory.pagecache.async
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Use async I/O for page cache. Setting is supported only on x86 Linux and only for a subset of operations.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===

For more information about asynchronous I/O in Neo4j, see xref:performance/disks-ram-and-other-tips.adoc#asynchronous-io-in-Neo4j[Performance -> Disks, RAM and other tips].


[[config_server.memory.pagecache.directio]]
=== `server.memory.pagecache.directio`

.server.memory.pagecache.directio
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Use direct I/O for page cache. This setting is supported only on Linux and only for a subset of record formats that use platform-aligned page size.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--dynamic]
[[config_server.memory.pagecache.flush.buffer.enabled]]
=== `server.memory.pagecache.flush.buffer.enabled`

.server.memory.pagecache.flush.buffer.enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Page cache can be configured to use a temporal buffer for flushing purposes. It is used to combine, if possible, sequence of several cache pages into one bigger buffer to minimize the number of individual IOPS performed and better utilization of available I/O resources, especially when those are restricted.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--dynamic]
[[config_server.memory.pagecache.flush.buffer.size_in_pages]]
=== `server.memory.pagecache.flush.buffer.size_in_pages`

.server.memory.pagecache.flush.buffer.size_in_pages
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Page cache can be configured to use a temporal buffer for flushing purposes. It is used to combine, if possible, sequence of several cache pages into one bigger buffer to minimize the number of individual IOPS performed and better utilization of available I/O resources, especially when those are restricted. Use this setting to configure individual file flush the buffer size in pages (8KiB). To be able to utilize this buffer during page cache flushing, buffered flush should be enabled.
|Valid values
a|An integer that is in the range `1` to `512`.
|Default value
m|+++128+++
|===


[[config_server.memory.pagecache.scan.prefetchers]]
=== `server.memory.pagecache.scan.prefetchers`

.server.memory.pagecache.scan.prefetchers
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of worker threads to use for pre-fetching data when doing sequential scans. Set to '0' to disable pre-fetching for scans.
|Valid values
a|An integer that is in the range `0` to `255`.
|Default value
m|+++4+++
|===


[[config_server.memory.pagecache.size]]
=== `server.memory.pagecache.size`

.server.memory.pagecache.size
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The amount of memory to use for mapping the store files. If Neo4j is running on a dedicated server, then it is generally recommended to leave about 2-4 gigabytes for the operating system, give the JVM enough heap to hold all your transaction state and query context, and then leave the rest for the page cache. If no page cache memory is configured, then a heuristic setting is computed based on available system resources. By default the size of page cache will be 50% of available RAM minus the max heap size. The size of the page cache will also not be larger than 70x the max heap size (due to some overhead of the page cache in the heap.
|Valid values
a|A byte size (valid multipliers are `B`, `KiB`, `KB`, `K`, `kB`, `kb`, `k`, `MiB`, `MB`, `M`, `mB`, `mb`, `m`, `GiB`, `GB`, `G`, `gB`, `gb`, `g`, `TiB`, `TB`, `PiB`, `PB`, `EiB`, `EB`).
|Default value
m|
|===


[role=label--enterprise-edition]
[[config_server.memory.query_cache.sharing_enabled]]
=== `server.memory.query_cache.sharing_enabled`

.server.memory.query_cache.sharing_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable sharing cache space between different databases.
With this option turned on, databases will share cache space, but not cache entries.
This means that a database may store and retrieve entries from the shared cache, but it may not retrieve entries produced by another database.
The database may, however, evict entries from other databases as necessary, according to the constrained cache size and cache eviction policy.
In essence, databases may compete for cache space, but may not observe each other's entries.

When this option is turned on, the cache space available to all databases is configured with `server.memory.query_cache.shared_cache_num_entries`.
With this option turned off, the cache space available to each individual database is configured with `server.memory.query_cache.per_db_cache_num_entries`.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--dynamic label--enterprise-edition]
[[config_server.memory.query_cache.shared_cache_num_entries]]
=== `server.memory.query_cache.shared_cache_num_entries`

.server.memory.query_cache.shared_cache_num_entries
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The number of cached queries for all databases.
The maximum number of queries that can be kept in a cache is exactly `server.memory.query_cache.shared_cache_num_entries`.
This setting is only deciding cache size when `server.memory.query_cache.sharing_enabled` is set to `true`.
|Valid values
a|An integer that is minimum `0`.
|Default value
m|+++1000+++
|===


[role=label--dynamic]
[[config_server.memory.query_cache.per_db_cache_num_entries]]
=== `server.memory.query_cache.per_db_cache_num_entries`

.server.memory.query_cache.per_db_cache_num_entries
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The number of cached queries per database.
The maximum number of queries that can be kept in a cache is `number of databases` * `server.memory.query_cache.per_db_cache_num_entries`.
With 10 databases and `server.memory.query_cache.per_db_cache_num_entries`=1000, the cache can keep 10000 plans in total.
This setting is only deciding cache size when `server.memory.query_cache.sharing_enabled` is set to `false`.
|Valid values
a|An integer that is minimum `0`.
|Default value
m|+++1000+++
|===

