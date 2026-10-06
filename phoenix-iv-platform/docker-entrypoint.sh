#!/bin/sh
# Entrypoint: start the app immediately (so Render sees an open port),
# and run database setup in the background with visible logs.

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
  npx prisma db push --accept-data-loss --skip-generate || { echo "[bootstrap] FAILED: schema push"; return 1; }

  echo "[bootstrap] seeding synthetic test fixtures (idempotent)..."
  npx ts-node prisma/seed.ts || { echo "[bootstrap] FAILED: seed"; return 1; }

  if [ "${DEV_APPROVE_SAMPLE_CONTENT:-false}" = "true" ]; then
    echo "[bootstrap] DEV_APPROVE_SAMPLE_CONTENT=true - activating SAMPLE clinical content for manual testing ONLY"
    npx ts-node prisma/dev-approve-sample-content.ts || echo "[bootstrap] WARNING: dev-approve step failed (non-fatal)"
  fi

  echo "[bootstrap] DONE"
}

bootstrap &

exec "$@"
