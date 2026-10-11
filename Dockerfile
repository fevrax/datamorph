FROM node:20-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
# Release metadata is public and is baked into the static frontend, not read at runtime.
ARG APP_VERSION
ARG APP_COMMIT_SHA
ARG APP_BUILD_TIME
RUN APP_VERSION="$APP_VERSION" APP_COMMIT_SHA="$APP_COMMIT_SHA" APP_BUILD_TIME="$APP_BUILD_TIME" pnpm build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-ai-proxy.sh /docker-entrypoint.d/40-ai-proxy.sh
RUN chmod +x /docker-entrypoint.d/40-ai-proxy.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
