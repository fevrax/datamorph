import type { Plugin, UserConfig } from "vite";

/** Development-only counterpart of the container's same-origin AI proxy. */
export function siteAIProxy(env: Record<string, string>): Plugin {
  const apiKey = env.OPENAI_API_KEY || "";
  const baseURL = (env.OPENAI_BASE_URL || "").replace(/\/+$/, "");
  const configured = !!apiKey && !!baseURL;
  if (apiKey && !/^[a-zA-Z0-9._~+/-]+$/.test(apiKey)) {
    throw new Error("Invalid OPENAI_API_KEY format");
  }
  if (
    baseURL &&
    !/^https:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*(\/[a-zA-Z0-9/_-]*)?$/.test(baseURL)
  ) {
    throw new Error("OPENAI_BASE_URL must be an HTTPS API base URL");
  }
  const modelIds = [
    ...new Set(
      (env.OPENAI_MODELS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (configured && modelIds.some((id) => /[^a-zA-Z0-9._:/@+-]/.test(id))) {
    throw new Error("Invalid OPENAI_MODELS model ID");
  }
  const modelsResponse = modelIds.length
    ? JSON.stringify({
        object: "list",
        data: modelIds.map((id) => ({
          id,
          object: "model",
          created: 0,
          owned_by: "site",
        })),
      })
    : null;
  return {
    name: "site-ai-proxy",
    apply: "serve",
    config: (): UserConfig => ({
      server: {
        proxy: configured
          ? {
              [modelsResponse
                ? "^/api/ai/v1/chat/completions$"
                : "^/api/ai/v1/(models|chat/completions)$"]: {
                target: baseURL,
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/api\/ai\/v1/, ""),
                timeout: 120000,
                proxyTimeout: 120000,
                configure: (proxy) => {
                  proxy.on("proxyReq", (request) => {
                    request.setHeader("Authorization", `Bearer ${apiKey}`);
                    request.removeHeader("cookie");
                  });
                },
              },
            }
          : {},
      },
    }),
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/api/ai/")) return next();
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        const fail = (status: number, message: string) => {
          response.statusCode = status;
          response.end(JSON.stringify({ error: { message } }));
        };
        if (
          request.headers["sec-fetch-site"] === "cross-site" ||
          (request.headers.origin &&
            request.headers.origin !== `http://${request.headers.host}` &&
            request.headers.origin !== `https://${request.headers.host}`)
        ) {
          return fail(403, "不允许跨站访问 AI 代理");
        }
        const method =
          request.url === "/api/ai/v1/models"
            ? "GET"
            : request.url === "/api/ai/v1/chat/completions"
              ? "POST"
              : null;
        if (!method) return fail(404, "接口不存在");
        if (request.method !== method) return fail(405, "请求方法不支持");
        if (!configured)
          return fail(503, "站点API尚未配置，请在 .env 中设置 API 地址和密钥");
        if (modelsResponse && request.url === "/api/ai/v1/models") {
          return response.end(modelsResponse);
        }
        next();
      });
    },
  };
}
