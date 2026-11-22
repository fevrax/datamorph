import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import test from "node:test";
import { siteAIProxy } from "./aiProxy";

test("development proxy only forwards approved API operations and injects the server key", async () => {
  for (const [configured, models, expectedIds] of [
    [false, "gpt-4o-mini", []],
    [true, "", []],
    [true, " , \t, ", []],
    [
      true,
      " gpt-4o-mini, org/model:v2@fp+4 ,gpt-4o-mini, ",
      ["gpt-4o-mini", "org/model:v2@fp+4"],
    ],
  ] as const) {
    const plugin = siteAIProxy(
      configured
        ? {
            OPENAI_API_KEY: "server-test-key",
            OPENAI_BASE_URL: "https://example.com/v1",
            OPENAI_MODELS: models,
          }
        : { OPENAI_MODELS: models },
    );
    let handler: any;
    (plugin.configureServer as Function)({
      middlewares: {
        use: (value: unknown) => {
          handler = value;
        },
      },
    });
    const server = createServer((req, res) =>
      handler(req, res, () => {
        res.end("forwarded");
      }),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as { port: number };
    const send = (path: string, method: string, headers = {}) =>
      new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = request(
          { hostname: "127.0.0.1", port: address.port, path, method, headers },
          (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ status: res.statusCode!, body }));
          },
        );
        req.on("error", reject);
        req.end();
      });
    const check = async (path: string, method: string, headers = {}) =>
      (await send(path, method, headers)).status;
    try {
      const response = await send("/api/ai/v1/models", "GET");
      assert.equal(response.status, configured ? 200 : 503);
      if (expectedIds.length) {
        assert.deepEqual(JSON.parse(response.body), {
          object: "list",
          data: expectedIds.map((id) => ({
            id,
            object: "model",
            created: 0,
            owned_by: "site",
          })),
        });
      } else if (configured) {
        assert.equal(response.body, "forwarded");
      }
      assert.equal(
        await check("/api/ai/v1/chat/completions", "POST"),
        configured ? 200 : 503,
      );
      assert.equal(await check("/api/ai/v1/models", "POST"), 405);
      assert.equal(await check("/api/ai/v1/files", "GET"), 404);
      assert.equal(
        await check("/api/ai/v1/models", "GET", {
          "sec-fetch-site": "cross-site",
        }),
        403,
      );
      assert.equal(
        await check("/api/ai/v1/models", "GET", {
          origin: "https://other.example",
        }),
        403,
      );
      if (configured) {
        const config = (plugin.config as Function)();
        const [[pattern, proxy]] = Object.entries<any>(config.server.proxy);
        assert.equal(
          new RegExp(pattern).test("/api/ai/v1/models"),
          !expectedIds.length,
        );
        assert.match("/api/ai/v1/chat/completions", new RegExp(pattern));
        assert.equal(proxy.target, "https://example.com/v1");
        assert.equal(proxy.rewrite("/api/ai/v1/models"), "/models");
        const headers = new Map([
          ["cookie", "private-cookie"],
          ["Authorization", "browser-key"],
        ]);
        proxy.configure({
          on: (_event: string, handler: Function) =>
            handler({
              setHeader: (name: string, value: string) =>
                headers.set(name, value),
              removeHeader: (name: string) => headers.delete(name),
            }),
        });
        assert.equal(headers.get("Authorization"), "Bearer server-test-key");
        assert.equal(headers.has("cookie"), false);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});

test("development API configuration rejects insecure or injected URLs and keys", () => {
  for (const baseURL of [
    "http://example.com/v1",
    "https://example.com/v1?key=x",
    "https://user:pass@example.com/v1",
  ]) {
    assert.throws(() => siteAIProxy({ OPENAI_BASE_URL: baseURL }));
  }
  assert.throws(() => siteAIProxy({ OPENAI_API_KEY: "key\nheader" }));
});

test("development proxy rejects unsupported model ID characters", () => {
  assert.throws(
    () =>
      siteAIProxy({
        OPENAI_API_KEY: "server-test-key",
        OPENAI_BASE_URL: "https://example.com/v1",
        OPENAI_MODELS: "valid, invalid model",
      }),
    /Invalid OPENAI_MODELS/,
  );
});
