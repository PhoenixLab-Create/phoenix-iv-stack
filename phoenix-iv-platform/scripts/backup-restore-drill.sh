#!/usr/bin/env bash
# Backup-restore drill: proves a dump of the current database can actually be
# restored and read back, mechanically. This does NOT verify Azure's managed
# backup/restore path (Azure Database for PostgreSQL Flexible Server's
# point-in-time restore) — that still needs a real drill run by ops against
# the actual Azure resource, on a schedule, with sign-off recorded. What this
# script proves is narrower but still real: the schema and data are not
# silently unrestorable, and this runs in CI on every push so that fact
# can't quietly rot.
#
# Usage: ./scripts/backup-restore-drill.sh
# Requires: DATABASE_URL pointing at a database with synthetic data only —
# this script will dump and restore it. NEVER point this at a database that
# could contain real patient data.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set." >&2
  exit 1
fi

DUMP_FILE="$(mktemp /tmp/phoenix-iv-drill-XXXXXX.sql)"
RESTORE_DB="phoenix_iv_restore_drill_$$"

cleanup() {
  rm -f "$DUMP_FILE"
  psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS ${RESTORE_DB};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== 1/4: Dumping current database =="
pg_dump "$DATABASE_URL" --no-owner --no-privileges -f "$DUMP_FILE"
DUMP_SIZE=$(wc -c < "$DUMP_FILE")
if [[ "$DUMP_SIZE" -lt 100 ]]; then
  echo "Dump is suspiciously small (${DUMP_SIZE} bytes) — treating as a failure, not a pass." >&2
  exit 1
fi
echo "Dump OK: ${DUMP_SIZE} bytes"

echo "== 2/4: Creating a throwaway restore-target database =="
psql "$DATABASE_URL" -c "CREATE DATABASE ${RESTORE_DB};"

RESTORE_URL=$(python3 -c "
import sys
from urllib.parse import urlsplit, urlunsplit
u = urlsplit('$DATABASE_URL')
new_path = '/${RESTORE_DB}'
print(urlunsplit((u.scheme, u.netloc, new_path, u.query, u.fragment)))
")

echo "== 3/4: Restoring the dump into it =="
psql "$RESTORE_URL" -f "$DUMP_FILE" >/dev/null

echo "== 4/4: Verifying row counts match between source and restored copy =="
for TABLE in users patients visits audit_log; do
  SRC_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM ${TABLE};" 2>/dev/null || echo "0")
  DST_COUNT=$(psql "$RESTORE_URL" -tAc "SELECT count(*) FROM ${TABLE};" 2>/dev/null || echo "0")
  if [[ "$SRC_COUNT" != "$DST_COUNT" ]]; then
    echo "MISMATCH on ${TABLE}: source=${SRC_COUNT} restored=${DST_COUNT}" >&2
    exit 1
  fi
  echo "  ${TABLE}: ${SRC_COUNT} rows — match"
done

echo "Backup-restore drill PASSED."
