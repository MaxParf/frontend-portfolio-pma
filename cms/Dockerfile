FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://127.0.0.1:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm ci
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-bookworm AS runtime
USER root
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
COPY --chown=101:101 --chmod=0644 nginx.conf /etc/nginx/conf.d/default.conf
RUN find /usr/share/nginx/html -type d -exec chmod 0755 {} + && \
  find /usr/share/nginx/html -type f -exec chmod 0644 {} +
USER 101
EXPOSE 8080
