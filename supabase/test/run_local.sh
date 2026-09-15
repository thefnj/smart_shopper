#!/usr/bin/env bash
# Applies the migration twice (proves it is rerunnable) and runs the behaviour tests
# against a local Postgres. Needs psql on PATH and a superuser connection in $PGURL,
# e.g. PGURL=postgres://postgres@localhost:5432/postgres npm run db:test
set -euo pipefail
PGURL="${PGURL:-postgres://postgres@localhost:5432/postgres}"
DB=ss_test
psql "$PGURL" -qc "drop database if exists $DB" -c "create database $DB"
TEST_URL="${PGURL%/*}/$DB"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -c 'create extension if not exists pgcrypto' \
  -f supabase/test/local_stubs.sql \
  -f supabase/migrations/0001_initial_schema.sql \
  -f supabase/seed.sql
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/0001_initial_schema.sql -f supabase/seed.sql
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/test/schema_behaviour.sql 2>&1 | grep -v NOTICE
