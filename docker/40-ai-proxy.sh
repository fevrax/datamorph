#!/bin/sh
set -eu

# This runs in the nginx container, never during the frontend build.
# Keep the generated file outside the document root and restrict its permissions.
config_path=${AI_PROXY_CONFIG_PATH:-/etc/nginx/ai-proxy.conf}
umask 077

write_disabled_config() {
  cat > "$config_path" <<'NGINX'
location ^~ /api/ai/ {
    default_type application/json;
    add_header Cache-Control "no-store" always;
    return 503 '{"error":{"message":"站点 AI 线路未配置，请使用私有API或联系管理员"}}';
}
NGINX
}

# Always replace a previous configuration, including on a restart without a key.
write_disabled_config

api_key=${OPENAI_API_KEY:-}
if [ -z "$api_key" ]; then
  exit 0
fi

base_url=${OPENAI_BASE_URL:-}
if [ -z "$base_url" ]; then
  echo "OPENAI_BASE_URL is required when OPENAI_API_KEY is set" >&2
  exit 1
fi
case "$base_url" in
  https://*) upstream=${base_url#https://} ;;
  *) echo "OPENAI_BASE_URL must be an HTTPS URL" >&2; exit 1 ;;
esac

upstream_host=${upstream%%/*}
if [ "$upstream" = "$upstream_host" ]; then
  upstream_path=""
else
  upstream_path=/${upstream#*/}
fi

# Reject nginx directives, variables, whitespace and multiline injection.
case "$api_key" in
  *[!a-zA-Z0-9._~+/-]*) echo "Invalid OPENAI_API_KEY format" >&2; exit 1 ;;
esac
case "$upstream_host" in
  ''|*[!a-zA-Z0-9.-]*|.*|-*|*.) echo "Invalid OPENAI_BASE_URL host" >&2; exit 1 ;;
esac
case "$upstream_path" in
  *[!a-zA-Z0-9/_-]*|*..*) echo "Invalid OPENAI_BASE_URL path" >&2; exit 1 ;;
esac
upstream_path=${upstream_path%/}

# Only expose the two API operations used by the UI, not a general proxy.
for endpoint in chat/completions models; do
  if [ "$endpoint" = models ]; then
    allowed_method=GET
  else
    allowed_method=POST
  fi
  cat >> "$config_path" <<NGINX

location = /api/ai/v1/$endpoint {
    if (\$request_method != $allowed_method) { return 405; }
    if (\$http_sec_fetch_site = cross-site) { return 403; }
    limit_req zone=ai_requests burst=3 nodelay;
    limit_req_status 429;
    limit_conn ai_connections 2;
    limit_conn_status 429;
    client_max_body_size 1m;
    proxy_pass https://$upstream_host$upstream_path/$endpoint;
    proxy_http_version 1.1;
    proxy_set_header Host "$upstream_host";
    proxy_set_header Authorization "Bearer $api_key";
    proxy_set_header Cookie "";
    proxy_set_header Connection "";
    proxy_ssl_server_name on;
    proxy_ssl_name "$upstream_host";
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_connect_timeout 15s;
    proxy_read_timeout 120s;
    proxy_buffering off;
    proxy_cache off;
    proxy_ignore_client_abort off;
    add_header Cache-Control "no-store" always;
}
NGINX
done
