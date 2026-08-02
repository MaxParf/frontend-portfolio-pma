FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app/backend
COPY package.json /app/package.json
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json backend/package-lock.json backend/tsconfig.json backend/drizzle.config.ts ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/drizzle ./drizzle
COPY contracts /app/contracts
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system portfolio && useradd --system --gid portfolio --home-dir /app portfolio
RUN mkdir -p /app/storage/project-media && chown -R portfolio:portfolio /app/storage
COPY --from=build --chown=portfolio:portfolio /app/backend/package.json ./package.json
COPY --from=build --chown=portfolio:portfolio /app/package.json ./package.json
COPY --from=build --chown=portfolio:portfolio /app/node_modules ./node_modules
COPY --from=build --chown=portfolio:portfolio /app/backend/node_modules ./node_modules
COPY --from=build --chown=portfolio:portfolio /app/backend/dist ./dist
COPY --from=build --chown=portfolio:portfolio /app/backend/dist/contracts ./dist/contracts
COPY --from=build --chown=portfolio:portfolio /app/backend/drizzle ./drizzle
VOLUME ["/app/storage/project-media"]
USER portfolio
EXPOSE 3001
CMD ["node", "dist/backend/src/server.js"]
