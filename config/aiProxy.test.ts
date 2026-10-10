import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import test from "node:test";
import { siteAIProxy } from "./aiProxy";

test("development proxy only forwards approved API operations and injects the server key", async () => {
  for (const configured of [false, true]) {
    const plugin = siteAIProxy(
      configured
        ? {
            OPENAI_API_KEY: "server-test-key",
            OPENAI_BASE_URL: "https://example.com/v1",
          }
        : {},
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
    const check = (path: string, method: string, headers = {}) =>
      new Promise<number>((resolve, reject) => {
        const req = request(
          { hostname: "127.0.0.1", port: address.port, path, method, headers },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode!));
          },
        );
        req.on("error", reject);
        req.end();
      });
    try {
      assert.equal(
        await check("/api/ai/v1/models", "GET"),
        configured ? 200 : 503,
      );
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
        const proxy = Object.values(config.server.proxy)[0] as any;
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
