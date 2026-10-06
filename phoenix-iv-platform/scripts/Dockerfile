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
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
