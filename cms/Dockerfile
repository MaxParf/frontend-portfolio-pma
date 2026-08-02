FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
WORKDIR /app/cms
ARG VITE_API_BASE_URL=http://127.0.0.1:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY cms/package.json cms/package-lock.json cms/tsconfig.json cms/vite.config.ts cms/index.html ./
COPY cms/src ./src
COPY contracts /app/contracts
RUN npm ci
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-bookworm AS runtime
USER root
COPY --from=build --chown=101:101 /app/cms/dist /usr/share/nginx/html
COPY cms/nginx.conf /etc/nginx/conf.d/default.conf
RUN find /usr/share/nginx/html -type d -exec chmod 0755 {} + && \
  find /usr/share/nginx/html -type f -exec chmod 0644 {} +
USER 101
EXPOSE 8080
