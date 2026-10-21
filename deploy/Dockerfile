FROM node:24-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

FROM dependencies AS build

COPY . .
RUN npm run build

FROM dependencies AS migrator

COPY . .
WORKDIR /app/apps/api
CMD ["../../node_modules/.bin/drizzle-kit", "migrate", "--config", "drizzle.config.ts"]

FROM node:24-alpine AS production-dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/build apps/web/build
COPY packages/contracts/package.json packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist packages/contracts/dist

USER node
EXPOSE 3000 4000
