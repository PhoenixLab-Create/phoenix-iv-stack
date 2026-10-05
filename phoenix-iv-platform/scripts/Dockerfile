# Dev/test image — not the hardened production build. Keeps devDependencies
# (ts-node, typescript, prisma CLI) so prisma migrate/seed can run from
# inside the container, which production would instead do as a separate
# release step with a slimmer runtime image.
FROM node:22-alpine

WORKDIR /app

# Native deps for argon2 to build on alpine.
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

RUN chmod +x docker-entrypoint.sh scripts/migrate-and-seed.sh

EXPOSE 3000
# No ENTRYPOINT here on purpose: Render runs this image's plain CMD, which
# must bind its port immediately (see scripts/migrate-and-seed.sh's header
# for why). Local docker-compose overrides `entrypoint:` to
# docker-entrypoint.sh instead, which runs migrations/seed first and then
# execs this same CMD.
CMD ["npm", "run", "start"]
