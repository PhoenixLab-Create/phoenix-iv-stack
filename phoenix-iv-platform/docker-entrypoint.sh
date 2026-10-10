#!/bin/sh
# Self-contained entrypoint (used by both Render and local docker-compose).
#
# Why this is shaped the way it is: the app must bind its port IMMEDIATELY or
# Render's port scanner kills the deploy ("No open ports detected" ->
# "Timed Out"). An earlier version of this script ran wait-for-Postgres /
# schema push / seed in the FOREGROUND before starting the app, and its wait
# loop discarded all error output, so when it never finished the deploy just
# timed out with no explanation.
#
# Now: bootstrap runs in the BACKGROUND (all output visible in the logs,
# prefixed [bootstrap]) while the app starts straight away. PrismaService only
# needs the database to be reachable at startup (it calls $connect), not for
# tables to exist, so starting before the schema is applied is safe.
# Test accounts may not log in until "[bootstrap] DONE" appears in the logs.
 
bootstrap() {
  echo "[bootstrap] waiting for database..."
  tries=0
  until node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRawUnsafe('SELECT 1')
      .then(() => process.exit(0))
      .catch((e) => { console.error('[bootstrap] database not ready:', String(e.message).trim().split('\n').pop()); process.exit(1); });
  "; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then
      echo "[bootstrap] FAILED: database never became reachable after 60 attempts"
      return 1
    fi
    sleep 3
  done
  echo "[bootstrap] database reachable"
 
  echo "[bootstrap] applying schema (prisma db push)..."
  # No Prisma migration history exists yet (the one-time `prisma migrate dev`
  # step was never run in a sandbox with a live DB). `db push` syncs the DB to
  # schema.prisma - fine for this test/demo deployment, NOT for production.
  npx prisma db push --accept-data-loss --skip-generate || { echo "[bootstrap] FAILED: schema push"; return 1; }
 
  # The seed is heavy (compiles TypeScript, hashes passwords) and NOT truly
  # idempotent (it re-creates sample protocols/products). Free hosting wakes
  # this service up often, so only seed the FIRST time - when no users exist.
  existing=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRawUnsafe('SELECT count(*)::int AS n FROM users')
      .then((r) => { console.log(r[0].n); process.exit(0); })
      .catch(() => { console.log(0); process.exit(0); });
  " 2>/dev/null | tail -n 1)
  if [ "${existing:-0}" -gt 0 ]; then
    echo "[bootstrap] database already seeded ($existing users) - skipping sample data, syncing role permissions only"
    SYNC_ONLY=1 npx ts-node prisma/seed.ts || echo "[bootstrap] WARNING: permission sync failed (non-fatal)"
    echo "[bootstrap] DONE"
    return 0
  fi
 
  echo "[bootstrap] seeding synthetic test fixtures (first run only)..."
  npx ts-node prisma/seed.ts || { echo "[bootstrap] FAILED: seed"; return 1; }
 
  if [ "${DEV_APPROVE_SAMPLE_CONTENT:-false}" = "true" ]; then
    echo "[bootstrap] DEV_APPROVE_SAMPLE_CONTENT=true - activating SAMPLE clinical content for manual testing ONLY"
    npx ts-node prisma/dev-approve-sample-content.ts || echo "[bootstrap] WARNING: dev-approve step failed (non-fatal)"
  fi
 
  echo "[bootstrap] DONE"
}
 
bootstrap &
 
exec "$@"
 
Claude finished the response
