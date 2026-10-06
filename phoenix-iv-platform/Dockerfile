# Dev/test image - not the hardened production build. Keeps devDependencies
# (ts-node, typescript, prisma CLI) so schema push / seed can run from inside
# the container.
FROM node:22-alpine

WORKDIR /app

# Native deps for argon2 to build on alpine.
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Strip Windows line endings / a UTF-8 BOM if the file picked them up in transit,
# then run it via `sh` explicitly so a missing/odd shebang can't cause
# "exec format error".
RUN sed -i 's/\r$//; 1s/^\xEF\xBB\xBF//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["sh", "/usr/local/bin/docker-entrypoint.sh"]
# The compiled entry point lands at dist/main.js or dist/src/main.js depending
# on how TypeScript infers its root folder (prisma/*.ts sits beside src/), so
# pick whichever exists instead of hard-coding one.
CMD ["sh", "-c", "node $(ls dist/main.js dist/src/main.js 2>/dev/null | head -n 1)"]
