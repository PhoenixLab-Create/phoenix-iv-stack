#!/bin/sh
# Dev/test entrypoint: wait for Postgres, apply migrations, seed synthetic
# fixtures (idempotent — upserts), then hand off to the real command. Never
# used for a production deploy, where migration and seeding are deliberate,
# separate, audited steps — not something that happens automatically on
# container start.
set -e

echo "Waiting for Postgres at ${DATABASE_URL}..."
until echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; do
  sleep 1
done
echo "Postgres is up."

echo "Applying migrations..."
npx prisma migrate deploy

echo "Seeding synthetic test fixtures (safe to re-run; upserts only)..."
npx ts-node prisma/seed.ts

if [ "${DEV_APPROVE_SAMPLE_CONTENT:-false}" = "true" ]; then
  echo "DEV_APPROVE_SAMPLE_CONTENT=true — activating sample screening rule/protocols/consent template for manual testing ONLY."
  npx ts-node prisma/dev-approve-sample-content.ts || true
fi

exec "$@"
