\echo '--- server ---'
SELECT version() AS v \gset
\echo :'v'
\echo '--- extensions ---'
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector','pgcrypto') ORDER BY 1;
\echo '--- pgvector actually computes ---'
SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector AS l2_distance,
       '[1,2,3]'::vector <=> '[1,2,4]'::vector AS cosine_distance;
\echo '--- roles (none of ours may be superuser) ---'
SELECT rolname, rolsuper, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname LIKE 'mk\_%' ORDER BY 1;
\echo '--- the reader must NOT be able to write ---'
SELECT has_database_privilege('mk_reader','mk_knowledge','CONNECT') AS reader_can_connect,
       has_schema_privilege('mk_reader','public','CREATE')          AS reader_can_create,
       has_schema_privilege('mk_app','public','CREATE')             AS app_can_create;
