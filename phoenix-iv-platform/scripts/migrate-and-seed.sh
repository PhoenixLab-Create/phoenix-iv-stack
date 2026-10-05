#!/bin/sh
# Wait for Postgres, apply schema, seed synthetic fixtures (idempotent —
# upserts). Does NOT start the app — this is meant to run as a separate
# pre-deploy step (Render's `preDeployCommand`, or as part of
# docker-entrypoint.sh for local docker-compose use), never inline in front
# of the app's own startup. Running it inline in front of `npm run start`
# was the original design and it caused real deploy failures on Render:
# this script is slow (each `npx prisma ...` call pays Node+CLI startup
# cost), and while it ran, the app never bound its port, so Render's port
# scanner timed out and killed the deploy before the app ever got a chance
# to start. Splitting this out fixes that: the app binds its port
# immediately, independent of how long migrations take.
set -e

echo "Waiting for Postgres at ${DATABASE_URL}..."
until echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; do
  echo "  ...still waiting"
  sleep 2
done
echo "Postgres is up."

echo "Applying schema..."
# No Prisma migration history exists yet in this repo (every sandbox this
# was built in had no live database to run `prisma migrate dev` against, so
# the one-time "generate the initial migration" step was never done — see
# README). `migrate deploy` would apply zero migrations and leave the
# database empty. `db push` introspects schema.prisma directly and syncs the
# database to match it — fine for this test/demo deployment, but it is NOT
# a substitute for real migrations: before production use, run
# `npx prisma migrate dev --name init` once against a real dev database,
# commit the generated prisma/migrations/ folder, and switch this back to
# `prisma migrate deploy`.
npx prisma db push --accept-data-loss --skip-generate

echo "Seeding synthetic test fixtures (safe to re-run; upserts only)..."
npx ts-node prisma/seed.ts

if [ "${DEV_APPROVE_SAMPLE_CONTENT:-false}" = "true" ]; then
  echo "DEV_APPROVE_SAMPLE_CONTENT=true — activating sample screening rule/protocols/consent template for manual testing ONLY."
  npx ts-node prisma/dev-approve-sample-content.ts || true
fi

echo "Migrate-and-seed complete."
