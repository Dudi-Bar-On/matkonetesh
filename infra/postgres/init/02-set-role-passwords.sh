#!/bin/bash
# Passwords are applied here, from the environment, so they never appear in a .sql file that
# could be committed. Runs once, alongside 01-*.sql, on an empty data directory only.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    ALTER ROLE mk_app    WITH PASSWORD '${MK_APP_PASSWORD}';
    ALTER ROLE mk_reader WITH PASSWORD '${MK_READER_PASSWORD}';
EOSQL

echo "role passwords applied for mk_app and mk_reader"
