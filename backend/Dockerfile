FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system portfolio && useradd --system --gid portfolio --home-dir /app portfolio
RUN mkdir -p /app/storage/project-media && chown -R portfolio:portfolio /app/storage
COPY --from=build --chown=portfolio:portfolio /app/package.json ./package.json
COPY --from=build --chown=portfolio:portfolio /app/node_modules ./node_modules
COPY --from=build --chown=portfolio:portfolio /app/dist ./dist
COPY --from=build --chown=portfolio:portfolio /app/drizzle ./drizzle
VOLUME ["/app/storage/project-media"]
USER portfolio
EXPOSE 3001
CMD ["node", "dist/src/server.js"]
