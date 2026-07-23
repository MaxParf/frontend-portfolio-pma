FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://127.0.0.1:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm ci
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-bookworm AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
