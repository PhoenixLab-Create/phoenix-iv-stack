# Dev/test image — runs the Vite dev server (with its /api proxy), not an
# optimized production build. For production, build a static bundle
# (`npm run build`) and serve it from a real web server/CDN instead.
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
