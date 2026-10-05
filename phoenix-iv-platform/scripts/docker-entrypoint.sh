#!/bin/sh
# Local docker-compose entrypoint ONLY: runs the full migrate-and-seed
# sequence, then hands off to the real start command. Render does NOT use
# this file as its entrypoint — it runs scripts/migrate-and-seed.sh as a
# separate `preDeployCommand` step instead, and the app image starts
# directly via `npm run start` (see Dockerfile and ../render.yaml), so the
# app binds its port immediately instead of waiting behind migrations.
set -e
/app/scripts/migrate-and-seed.sh
exec "$@"
