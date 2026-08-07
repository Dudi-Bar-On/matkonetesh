---
name: 27-configuration-settings-05
description: "Neo4j 2026.06.0 — Configuration settings reference (5/6): security settings (26/60, config)"
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



== Security settings

The security settings are used to configure the security of your Neo4j deployment.
Refer to the xref:security/index.adoc[Security] section for thorough information on security in Neo4j.


[[config_dbms.security.allow_csv_import_from_file_urls]]
=== `dbms.security.allow_csv_import_from_file_urls`


.dbms.security.allow_csv_import_from_file_urls
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Determines if Cypher will allow using file URLs when loading data using `LOAD CSV`. Setting this value to `false` will cause Neo4j to fail `LOAD CSV` clauses that load data from the file system.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.auth_cache_max_capacity]]
=== `dbms.security.auth_cache_max_capacity`

.dbms.security.auth_cache_max_capacity
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum capacity for authentication and authorization caches (respectively).
|Valid values
a|An integer.
|Default value
m|+++10000+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.auth_cache_ttl]]
=== `dbms.security.auth_cache_ttl`

.dbms.security.auth_cache_ttl
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The time to live (TTL) for cached authentication and authorization info when using external auth providers (OIDC, LDAP or plugin). Setting the TTL to 0 will disable auth caching. Disabling caching while using the LDAP auth provider requires the use of an LDAP system account for resolving authorization information.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++10m+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.auth_cache_use_ttl]]
=== `dbms.security.auth_cache_use_ttl`

.dbms.security.auth_cache_use_ttl
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable time-based eviction of the authentication and authorization info cache for external auth providers (OIDC, LDAP or plugin). Disabling this setting will make the cache live forever and only be evicted when <<config_dbms.security.auth_cache_max_capacity,`dbms.security.auth_cache_max_capacity`>> is exceeded.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_dbms.security.auth_enabled]]
=== `dbms.security.auth_enabled`

.dbms.security.auth_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable auth requirement to access Neo4j.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===



[[config_config_dbms.security.auth_minimum_password_length]]
=== `dbms.security.auth_minimum_password_length`

.dbms.security.auth_minimum_password_length
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The minimum number of characters required in a password.
|Valid values
a|An integer that is minimum `1`.
|Default value
m|+++8+++
|===


[[config_dbms.security.auth_lock_time]]
=== `dbms.security.auth_lock_time`

.dbms.security.auth_lock_time
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The amount of time user account should be locked after a configured number of unsuccessful authentication attempts. The locked out user will not be able to log in until the lock period expires, even if correct credentials are provided. Setting this configuration option to a low value is not recommended because it might make it easier for an attacker to brute force the password.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`) that is minimum `0s`.
|Default value
m|+++5s+++
|===


[[config_dbms.security.auth_max_failed_attempts]]
=== `dbms.security.auth_max_failed_attempts`

.dbms.security.auth_max_failed_attempts
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The maximum number of unsuccessful authentication attempts before imposing a user lock for  the configured amount of time, as defined by <<config_dbms.security.auth_lock_time,`dbms.security.auth_lock_time`>>.The locked out user will not be able to log in until the lock period expires, even if correct  credentials are provided. Setting this configuration option to values less than 3 is not recommended because it might make  it easier for an attacker to brute force the password.
|Valid values
a|An integer that is minimum `0`.
|Default value
m|+++3+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.authentication_providers]]
=== `dbms.security.authentication_providers`

.dbms.security.authentication_providers
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of security authentication providers containing the users and roles. This can be any of the built-in `native` or `ldap` providers, or it can be an externally provided plugin, with a custom name prefixed by `plugin-`, i.e. `plugin-<AUTH_PROVIDER_NAME>`. They will be queried in the given order when login is attempted.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|+++native+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.authorization_providers]]
=== `dbms.security.authorization_providers`

.dbms.security.authorization_providers
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of security authorization providers containing the users and roles. This can be any of the built-in `native` or `ldap` providers, or it can be an externally provided plugin, with a custom name prefixed by `plugin-`, i.e. `plugin-<AUTH_PROVIDER_NAME>`. They will be queried in the given order when login is attempted.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|+++native+++
|===


[role=label--enterprise-edition label--new-2026.03]
[[config_dbms.security.abac.authorization_providers]]
=== `dbms.security.abac.authorization_providers`

.dbms.security.abac.authorization_providers
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of the authorization providers whose attributes are used to evaluate auth rules.
|Valid values
a|A comma-separated list where each element is a string, which entries must be a valid OIDC authorization provider and entries must exist in dbms.security.authorization_providers.
|Default value
m|
|===

For more information, see xref:authentication-authorization/attribute-based-access-control.adoc[Attribute-based access control].

[role=label--enterprise-edition]
[[config_dbms.security.cluster_status_auth_enabled]]
=== `dbms.security.cluster_status_auth_enabled`

.dbms.security.cluster_status_auth_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Require authorization for access to the Causal Clustering status endpoints.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[[config_dbms.security.http_access_control_allow_origin]]
=== `dbms.security.http_access_control_allow_origin`

.dbms.security.http_access_control_allow_origin
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Value of the Access-Control-Allow-Origin header sent over any HTTP or HTTPS connector. This defaults to '*', which allows broadest compatibility. Note that any URI provided here limits HTTP/HTTPS access to that URI only.
|Valid values
a|A string.
|Default value
m|+++*+++
|===


[[config_dbms.security.http_auth_allowlist]]
=== `dbms.security.http_auth_allowlist`

.dbms.security.http_auth_allowlist
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Defines an allowlist of http paths where Neo4j authentication is not required.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|+++/,/browser.*+++
|===


[[config_dbms.security.http_strict_transport_security]]
=== `dbms.security.http_strict_transport_security`

.dbms.security.http_strict_transport_security
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Value of the HTTP Strict-Transport-Security (HSTS) response header. This header tells browsers that a webpage should only be accessed using HTTPS instead of HTTP. It is attached to every HTTPS response. Setting is not set by default so 'Strict-Transport-Security' header is not sent. Value is expected to contain directives like 'max-age', 'includeSubDomains' and 'preload'.
|Valid values
a|A string.
|Default value
m|
|===



[[config_dbms.security.http_static_content_security_policy_header]]
=== `dbms.security.http_static_content_security_policy_header`

.dbms.security.http_static_content_security_policy_header
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Defines the Content-Security-Policy header to return to content returned on static endpoints.
|Valid values
a|A string.
|Default value
m|+++default-src 'self'; script-src 'self' cdn.segment.com canny.io; img-src 'self' guides.neo4j.com data:; style-src 'self' fonts.googleapis.com 'unsafe-inline'; font-src 'self' fonts.gstatic.com; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; connect-src 'self' api.canny.io api.segment.io ws: wss: http: https:+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.key.name]]
=== `dbms.security.key.name`

.dbms.security.key.name
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Name of the 256 length AES encryption key, which is used for the symmetric encryption.
|Valid values
a|A string.
|Default value
m|+++aesKey+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.keystore.password]]
=== `dbms.security.keystore.password`

.dbms.security.keystore.password
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Password for accessing the keystore holding a 256 length AES encryption key, which is used for the symmetric encryption.
|Valid values
a|A secure string.
|Default value
m|
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.keystore.path]]
=== `dbms.security.keystore.path`

.dbms.security.keystore.path
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Location of the keystore holding a 256 length AES encryption key, which is used for the symmetric encryption of secrets held in system database.
|Valid values
a|A path.
|Default value
m|
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authentication.attribute]]
=== `dbms.security.ldap.authentication.attribute`

.dbms.security.ldap.authentication.attribute
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The attribute to use when looking up users.
Using this setting requires <<config_dbms.security.ldap.authentication.search_for_attribute,`dbms.security.ldap.authentication.search_for_attribute`>> to be `true` and thus <<config_dbms.security.ldap.authorization.system_username,`dbms.security.ldap.authorization.system_username`>> and <<config_dbms.security.ldap.authorization.system_password,`dbms.security.ldap.authorization.system_password`>> to be configured.
|Valid values
a|A string that matches the pattern `[A-Za-z0-9-]*` (has to be a valid LDAP attribute name, only containing letters [A-Za-z], digits [0-9] and hyphens [-].).
|Default value
m|+++samaccountname+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.authentication.cache_enabled]]
=== `dbms.security.ldap.authentication.cache_enabled`

.dbms.security.ldap.authentication.cache_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Determines if the result of authentication via the LDAP server should be cached or not. Caching is used to limit the number of LDAP requests that have to be made over the network for users that have already been authenticated successfully. A user can be authenticated against an existing cache entry (instead of via an LDAP server) as long as it is alive (see <<config_dbms.security.auth_cache_ttl,`dbms.security.auth_cache_ttl`>>).
An important consequence of setting this to `true` is that Neo4j then needs to cache a hashed version of the credentials in order to perform credentials matching. This hashing is done using a cryptographic hash function together with a random salt. Preferably a conscious decision should be made if this method is considered acceptable by the security standards of the organization in that this Neo4j instance is deployed.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.authentication.mechanism]]
=== `dbms.security.ldap.authentication.mechanism`

.dbms.security.ldap.authentication.mechanism
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|LDAP authentication mechanism. This is one of `simple` or a SASL mechanism supported by JNDI, for example `DIGEST-MD5`. `simple` is basic username and password authentication and SASL is used for more advanced mechanisms. See RFC 2251 LDAPv3 documentation for more details.
|Valid values
a|A string.
|Default value
m|+++simple+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.authentication.search_for_attribute]]
=== `dbms.security.ldap.authentication.search_for_attribute`

.dbms.security.ldap.authentication.search_for_attribute
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Perform authentication by searching for an unique attribute of a user.
Using this setting requires <<config_dbms.security.ldap.authorization.system_username,`dbms.security.ldap.authorization.system_username`>> and <<config_dbms.security.ldap.authorization.system_password,`dbms.security.ldap.authorization.system_password`>> to be configured.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authentication.user_dn_template]]
=== `dbms.security.ldap.authentication.user_dn_template`

.dbms.security.ldap.authentication.user_dn_template
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|LDAP user DN template. An LDAP object is referenced by its distinguished name (DN), and a user DN is an LDAP fully-qualified unique user identifier. This setting is used to generate an LDAP DN that conforms with the LDAP directory's schema from the user principal that is submitted with the authentication token when logging in. The special token {0} is a placeholder where the user principal will be substituted into the DN string.
|Valid values
a|A string that Must be a string containing '{0}' to understand where to insert the runtime authentication principal..
|Default value
m|+++uid={0},ou=users,dc=example,dc=com+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authorization.access_permitted_group]]
=== `dbms.security.ldap.authorization.access_permitted_group`

.dbms.security.ldap.authorization.access_permitted_group
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The LDAP group to which a user must belong to get any access to the system.Set this to restrict access to a subset of LDAP users belonging to a particular group. If this is not set, any user to successfully authenticate via LDAP will have access to the PUBLIC role and any other roles assigned to them via <<config_dbms.security.ldap.authorization.group_to_role_mapping,`dbms.security.ldap.authorization.group_to_role_mapping`>>.
|Valid values
a|A string.
|Default value
m|++++++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authorization.group_membership_attributes]]
=== `dbms.security.ldap.authorization.group_membership_attributes`

.dbms.security.ldap.authorization.group_membership_attributes
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of attribute names on a user object that contains groups to be used for mapping to roles when LDAP authorization is enabled. This setting is ignored when <<config_dbms.security.ldap.authorization.nested_groups_enabled,`dbms.security.ldap.authorization.nested_groups_enabled`>> is `true`.
|Valid values
a|A comma-separated list where each element is a string, which cannot be empty.
|Default value
m|+++memberOf+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authorization.group_to_role_mapping]]
=== `dbms.security.ldap.authorization.group_to_role_mapping`

.dbms.security.ldap.authorization.group_to_role_mapping
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|An authorization mapping from LDAP group names to Neo4j role names. The map should be formatted as a semicolon separated list of key-value pairs, where the key is the LDAP group name and the value is a comma separated list of corresponding role names. For example: group1=role1;group2=role2;group3=role3,role4,role5
You could also use whitespaces and quotes around group names to make this mapping more readable, for example:
----
`dbms.security.ldap.authorization.group_to_role_mapping`=\
         "cn=Neo4j Read Only,cn=users,dc=example,dc=com"      = reader;    \
         "cn=Neo4j Read-Write,cn=users,dc=example,dc=com"     = publisher; \
         "cn=Neo4j Schema Manager,cn=users,dc=example,dc=com" = architect; \
         "cn=Neo4j Administrator,cn=users,dc=example,dc=com"  = admin
----
|Valid values
a|A string that must be a semicolon-separated list of key-value pairs or empty.
|Default value
m|++++++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authorization.nested_groups_enabled]]
=== `dbms.security.ldap.authorization.nested_groups_enabled`

.dbms.security.ldap.authorization.nested_groups_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|This setting determines whether multiple LDAP search results will be processed (as is required for the lookup of nested groups). If set to `true` then instead of using attributes on the user object to determine group membership (as specified by <<config_dbms.security.ldap.authorization.group_membership_attributes,`dbms.security.ldap.authorization.group_membership_attributes`>>), the `user` object will only be used to determine the user's Distinguished Name, which will subsequently be used with  <<config_dbms.security.ldap.authorization.user_search_filter,`dbms.security.ldap.authorization.user_search_filter`>> in order to perform a nested group search. The Distinguished Names of the resultant group search results will be used to determine roles.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authorization.nested_groups_search_filter]]
=== `dbms.security.ldap.authorization.nested_groups_search_filter`

.dbms.security.ldap.authorization.nested_groups_search_filter
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The search template which will be used to find the nested groups which the user is a member of. The filter should contain the placeholder token `{0}` which will be substituted with the user's Distinguished Name (which is found for the specified user principle using <<config_dbms.security.ldap.authorization.user_search_filter,`dbms.security.ldap.authorization.user_search_filter`>>). The default value specifies Active Directory's LDAP_MATCHING_RULE_IN_CHAIN (aka 1.2.840.113556.1.4.1941) implementation which will walk the ancestry of group membership for the specified user.
|Valid values
a|A string.
|Default value
m|+++(&(objectclass=group)(member:1.2.840.113556.1.4.1941:={0}))+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.authorization.system_password]]
=== `dbms.security.ldap.authorization.system_password`

.dbms.security.ldap.authorization.system_password
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|An LDAP system account password to use for authorization searches when <<config_dbms.security.ldap.authorization.use_system_account,`dbms.security.ldap.authorization.use_system_account`>> is `true`.
|Valid values
a|A secure string.
|Default value
m|
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.authorization.system_username]]
===  `dbms.security.ldap.authorization.system_username`

.dbms.security.ldap.authorization.system_username
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|An LDAP system account username to use for authorization searches when <<config_dbms.security.ldap.authorization.use_system_account,`dbms.security.ldap.authorization.use_system_account`>> is `true`. Note that the <<config_dbms.security.ldap.authentication.user_dn_template,`dbms.security.ldap.authentication.user_dn_template`>> will not be applied to this username, so you may have to specify a full DN.
|Valid values
a|A string.
|Default value
m|
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.authorization.use_system_account]]
=== `dbms.security.ldap.authorization.use_system_account`

.dbms.security.ldap.authorization.use_system_account
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Perform LDAP search for authorization info using a system account instead of the user's own account.
If this is set to `false` (default), the search for group membership will be performed directly after authentication using the LDAP context bound with the user's own account. The mapped roles will be cached for the duration of <<config_dbms.security.auth_cache_ttl,`dbms.security.auth_cache_ttl`>>, and then expire, requiring re-authentication. To avoid frequently having to re-authenticate sessions you may want to set a relatively long auth cache expiration time together with this option. +
 NOTE: This option will only work if the users are permitted to search for their own group membership attributes in the directory.
If this is set to `true`, the search will be performed using a special system account user with read access to all the users in the directory. You need to specify the username and password using the settings <<config_dbms.security.ldap.authorization.system_username,`dbms.security.ldap.authorization.system_username`>> and <<config_dbms.security.ldap.authorization.system_password,`dbms.security.ldap.authorization.system_password`>> with this option. Note that this account only needs read access to the relevant parts of the LDAP directory and does not need to have access rights to Neo4j, or any other systems.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authorization.user_search_base]]
=== `dbms.security.ldap.authorization.user_search_base`

.dbms.security.ldap.authorization.user_search_base
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The name of the base object or named context to search for user objects when LDAP authorization is enabled. A common case is that this matches the last part of <<config_dbms.security.ldap.authentication.user_dn_template,`dbms.security.ldap.authentication.user_dn_template`>>.
|Valid values
a|A string that cannot be empty.
|Default value
m|+++ou=users,dc=example,dc=com+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.ldap.authorization.user_search_filter]]
=== `dbms.security.ldap.authorization.user_search_filter`

.dbms.security.ldap.authorization.user_search_filter
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The LDAP search filter to search for a user principal when LDAP authorization is enabled. The filter should contain the placeholder token {0} which will be substituted for the user principal.
|Valid values
a|A string.
|Default value
m|+++(&(objectClass=*)(uid={0}))+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.connection_timeout]]
=== `dbms.security.ldap.connection_timeout`

.dbms.security.ldap.connection_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The timeout for establishing an LDAP connection. If a connection with the LDAP server cannot be established within the given time the attempt is aborted. A value of 0 means to use the network protocol's (i.e., TCP's) timeout value.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++30s+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.host]]
=== `dbms.security.ldap.host`

.dbms.security.ldap.host
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|URL of LDAP server to use for authentication and authorization. The format of the setting is `<protocol>://<hostname>:<port>`, where hostname is the only required field. The supported values for protocol are `ldap` (default) and `ldaps`. The default port for `ldap` is 389 and for `ldaps` 636. For example: `ldaps://ldap.example.com:10389`.
You may want to consider using STARTTLS (<<config_dbms.security.ldap.use_starttls,`dbms.security.ldap.use_starttls`>>) instead of LDAPS for secure connections, in which case the correct protocol is `ldap`.
|Valid values
a|A string.
|Default value
m|+++localhost+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.read_timeout]]
=== `dbms.security.ldap.read_timeout`

.dbms.security.ldap.read_timeout
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The timeout for an LDAP read request (i.e. search). If the LDAP server does not respond within the given time the request will be aborted. A value of 0 means wait for a response indefinitely.
|Valid values
a|A duration (Valid units are: `ns`, `μs`, `ms`, `s`, `m`, `h` and `d`; default unit is `s`).
|Default value
m|+++30s+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.referral]]
=== `dbms.security.ldap.referral`

.dbms.security.ldap.referral
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The LDAP referral behavior when creating a connection. This is one of `follow`, `ignore` or `throw`.

* `follow` automatically follows any referrals
* `ignore` ignores any referrals
* `throw` throws an exception, which will lead to authentication failure.
|Valid values
a|A string.
|Default value
m|+++follow+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.ldap.use_starttls]]
=== `dbms.security.ldap.use_starttls`

.dbms.security.ldap.use_starttls
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Use secure communication with the LDAP server using opportunistic TLS. First an initial insecure connection will be made with the LDAP server, and a STARTTLS command will be issued to negotiate an upgrade of the connection to TLS before initiating authentication.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.log_successful_authentication]]
=== `dbms.security.log_successful_authentication`

.dbms.security.log_successful_authentication
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Set to log successful authentication events to the security log. If this is set to `false` only failed authentication events will be logged, which could be useful if you find that the successful events spam the logs too much, and you do not require full auditing capability.
|Valid values
a|A boolean.
|Default value
m|+++true+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.logs.ldap.groups_at_debug_level_enabled]]
=== `dbms.security.logs.ldap.groups_at_debug_level_enabled`

.dbms.security.logs.ldap.groups_at_debug_level_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|When set to `true`, will log the groups retrieved from the ldap server. This will only take effect when the security log level is set to `DEBUG`.WARNING: It is strongly advised that this is set to `false` when running in a production environment in order to prevent logging of sensitive information.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.audience]]
=== `dbms.security.oidc.<provider>.audience`

.dbms.security.oidc.<provider>.audience
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Expected values of the Audience (aud) claim in the id token.
|Valid values
a|A comma-separated list where each element is a string, which cannot be empty.
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.auth_endpoint]]
=== `dbms.security.oidc.<provider>.auth_endpoint`

.dbms.security.oidc.<provider>.auth_endpoint
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The OIDC authorization endpoint. If this is not supplied Neo4j will attempt to discover it from the well_known_discovery_uri.
|Valid values
a|a URI
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.auth_flow]]
=== `dbms.security.oidc.<provider>.auth_flow`

.dbms.security.oidc.<provider>.auth_flow
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The OIDC flow to use. This is exposed to clients via the discovery endpoint. Supported values are `pkce` and `implicit`
|Valid values
a|One of [PKCE, IMPLICIT].
|Default value
m|+++PKCE+++
|===


[role=label--enterprise-edition label--dynamic label--deprecated-5.0.0]
[[config_dbms.security.oidc.-provider-.auth_params]]
=== `dbms.security.oidc.<provider>.auth_params`

.dbms.security.oidc.<provider>.auth_params
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Optional additional parameters that the auth endpoint requires. Please use params instead. The map is a semicolon separated list of key-value pairs. For example: `k1=v1;k2=v2`.
|Valid values
a|A simple key value map pattern `k1=v1;k2=v2`.
|Default value
m|+++{}+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.authorization.group_to_role_mapping]]
=== `dbms.security.oidc.<provider>.authorization.group_to_role_mapping`

.dbms.security.oidc.<provider>.authorization.group_to_role_mapping
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|An authorization mapping from IdP group names to Neo4j role names. The map should be formatted as a semicolon separated list of key-value pairs, where the key is the IdP group name and the value is a comma separated list of corresponding role names. For example: group1=role1;group2=role2;group3=role3,role4,role5
You could also use whitespaces and quotes around group names to make this mapping more readable, for example:
----
dbms.security.oidc.<provider>.authorization.group_to_role_mapping=\
         "Neo4j Read Only"      = reader;    \
         "Neo4j Read-Write"     = publisher; \
         "Neo4j Schema Manager" = architect; \
         "Neo4j Administrator"  = admin
----
|Valid values
a|A string that must be semicolon-separated list of key-value pairs or empty
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.claims.groups]]
=== `dbms.security.oidc.<provider>.claims.groups`

.dbms.security.oidc.<provider>.claims.groups
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The claim to use as the list of groups in Neo4j. These could be Neo4J roles directly, or can be mapped using dbms.security.oidc.<provider>.authorization.group_to_role_mapping.
The claim specified should be a string type representing a single group, or an array of strings representing multiple groups.
|Valid values
a|A string.
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.claims.username]]
=== `dbms.security.oidc.<provider>.claims.username`

.dbms.security.oidc.<provider>.claims.username
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The claim to use as the username in Neo4j. This would typically be sub, but in some situations it may be desirable to use something else such as email.
|Valid values
a|A string.
|Default value
m|+++sub+++
|===


[role=label--enterprise-edition label--dynamic label--deprecated-5.19]
[[config_dbms.security.oidc.-provider-.client_id]]
=== `dbms.security.oidc.<provider>.client_id`

.dbms.security.oidc.<provider>.client_id
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Client id. Not used. This value was previously used to validate the `azp` claim in the id_token, but this validation has been removed in line with updates to the OIDC specification.
|Valid values
a|A string.
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.config]]
=== `dbms.security.oidc.<provider>.config`

.dbms.security.oidc.<provider>.config
[cols="<1s,<4a"]
|===
|Description
a|The accepted values (all optional) are:

* `principal`: in which JWT claim the user's email address is specified, email is the default. This is the value that will be shown in browser.
* `code_challenge_method`: default is `S256` and it's the only supported method at this moment. This setting applies only for pkce auth flow
* `token_type_principal`: the options are almost always either `access_token`, which is the default, or `id_token`.
* `token_type_authentication`: the options are almost always either `access_token`, which is the default, or `id_token`.
* `implicit_flow_requires_nonce`: `true` or `false`. Defaults to `false`.

|Valid values
a|A simple key-value map pattern `k1=v1;k2=v2`. Valid key options are: `[implicit_flow_requires_nonce, token_type_authentication, token_type_principal, principal, code_challenge_method]`.
|Default value
m|+++{}+++
|===


[[config_dbms.security.logs.oidc.jwt_claims_at_debug_level_enabled]]
=== `dbms.security.logs.oidc.jwt_claims_at_debug_level_enabled`

.dbms.security.logs.oidc.jwt_claims_at_debug_level_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|When set to `true`, it logs the claims from the JWT. This will only take effect when the security log level is set to `DEBUG`. +
[WARNING]
====
It is strongly advised that this is set to `false` when running in a production environment in order to prevent logging of sensitive information. Also note that the contents of the JWT claims set can change over time because they are dependent entirely upon the ID provider.
====
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition]
[[config_dbms.security.oidc.-provider-.display_name]]
=== `dbms.security.oidc.<provider>.display_name`

.dbms.security.oidc.<provider>.display_name
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The user-facing name of the provider as provided by the discovery endpoint to clients (Bloom, Browser etc.).
|Valid values
a|A string.
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.get_groups_from_user_info]]
=== `dbms.security.oidc.<provider>.get_groups_from_user_info`

.dbms.security.oidc.<provider>.get_groups_from_user_info
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|When turned on, Neo4j gets the groups from the provider user info endpoint.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.get_username_from_user_info]]
=== `dbms.security.oidc.<provider>.get_username_from_user_info`

.dbms.security.oidc.<provider>.get_username_from_user_info
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|When turned on, Neo4j gets the username from the provider user info endpoint.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.issuer]]
=== `dbms.security.oidc.<provider>.issuer`

.dbms.security.oidc.<provider>.issuer
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The expected value of the iss claim in the id token. If this is not supplied Neo4j will attempt to discover it from the well_known_discovery_uri.
|Valid values
a|A string.
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.jwks_uri]]
=== `dbms.security.oidc.<provider>.jwks_uri`

.dbms.security.oidc.<provider>.jwks_uri
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The location of the JWK public key set for the identity provider. If this is not supplied Neo4j will attempt to discover it from the well_known_discovery_uri.
|Valid values
a|a URI
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.params]]
=== `dbms.security.oidc.<provider>.params`

.dbms.security.oidc.<provider>.params
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The map is a semicolon separated list of key-value pairs. For example: `k1=v1;k2=v2`.
The user should at least provide:
----
  client_id: the SSO Idp client idenfifier.
  response_type: code if auth_flow is pkce or token for implicit auth_flow.
  scope: often containing a subset of 'email profile openid groups'.
----
For example: `client_id=my-client-id;response_type=code;scope=openid profile email`.
|Valid values
a|A simple key-value map pattern `k1=v1;k2=v2`. Required key options are: `[scope, client_id, response_type]`.
|Default value
m|+++{}+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.token_endpoint]]
=== `dbms.security.oidc.<provider>.token_endpoint`

.dbms.security.oidc.<provider>.token_endpoint
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The OIDC token endpoint. If this is not supplied Neo4j will attempt to discover it from the well_known_discovery_uri.
|Valid values
a|a URI
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.token_params]]
=== `dbms.security.oidc.<provider>.token_params`

.dbms.security.oidc.<provider>.token_params
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Optional query parameters that the token endpoint requires. The map is a semicolon separated list of key-value pairs. For example: `k1=v1;k2=v2`.If the token endpoint requires a client_secret then this parameter should contain `client_secret=super-secret`
|Valid values
a|A simple key value map pattern `k1=v1;k2=v2`.
|Default value
m|+++{}+++
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.user_info_uri]]
=== `dbms.security.oidc.<provider>.user_info_uri`

.dbms.security.oidc.<provider>.user_info_uri
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|The identity providers user info uri.
|Valid values
a|a URI
|===


[role=label--enterprise-edition label--dynamic]
[[config_dbms.security.oidc.-provider-.well_known_discovery_uri]]
=== `dbms.security.oidc.<provider>.well_known_discovery_uri`

.dbms.security.oidc.<provider>.well_known_discovery_uri
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|OpenID Connect Discovery endpoint used to fetch identity provider settings. If not provided, `issuer`, `jwks_uri`, `auth_endpoint` should be present. If the auth_flow is pkce, `token_endpoint` should also be provided.
|Valid values
a|a URI
|===


[[config_dbms.security.procedures.allowlist]]
=== `dbms.security.procedures.allowlist`

.dbms.security.procedures.allowlist
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of procedures (comma separated) that are to be loaded. The list may contain both fully-qualified procedure names, and partial names with the wildcard `\*`. The default (`*`) loads all procedures. If no value is specified, no procedures will be loaded.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|+++*+++
|===


[[config_dbms.security.procedures.unrestricted]]
=== `dbms.security.procedures.unrestricted`

.dbms.security.procedures.unrestricted
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|A list of procedures and user-defined functions (comma separated) that are allowed full access to the database. The list may contain both fully-qualified procedure names, and partial names with the wildcard `*`. Note that this enables these procedures to bypass security. Use with caution.
|Valid values
a|A comma-separated list where each element is a string.
|Default value
m|++++++
|===

[role=label--enterprise-edition]
[[config_dbms.security.require_local_user]]
=== `dbms.security.require_local_user`

.dbms.security.require_local_user
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|This controls if a local user has to be created for external authentication. If set to the default (`false`), no user has to be created to authenticate with an external authentication provider. If set to `true`, a user representing the external user must be created before they can authenticate successfully. +
External users must be explicitly mapped to local users. See xref:/authentication-authorization/auth-providers.adoc[User auth providers] for details. +
+NOTE+: This setting only works with the built-in auth providers (LDAP, SSO/OIDC).
Plugin authentication does not have access to validate whether a local user exists and can therefore not ensure this setting.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===


[role=label--enterprise-edition label--new-2025.03]
[[config_dbms.security.tls_reload_enabled]]
=== `dbms.security.tls_reload_enabled`

.dbms.security.tls_reload_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Enable the reloading to TLS configuration and certificates dynamically by calling a procedure.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===

[role=label--enterprise-edition label--new-2025.10]
[[config_dbms.security.allow_oidc_credential_forwarding_enabled]]
=== `dbms.security.allow_oidc_credential_forwarding_enabled`

.dbms.security.allow_oidc_credential_forwarding_enabled
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|When set to `true`, remote database aliases are allowed to forward OIDC credentials to authenticate on remote Neo4j DBMS. When set to `false`, OIDC credentials are not allowed to be forwarded to remote DBMS. Existing aliases that rely on this method remain defined but cannot be used to connect until this setting is enabled.
|Valid values
a|A boolean.
|Default value
m|+++false+++
|===

[[config_dbms.netty.ssl.provider]]
=== `dbms.netty.ssl.provider`

.dbms.netty.ssl.provider
[frame="topbot", stripes=odd, grid="cols", cols="<1s,<4"]
|===
|Description
a|Netty SSL provider.
|Valid values
a|One of [JDK, OPENSSL, OPENSSL_REFCNT].
|Default value
m|+++JDK+++
|===

