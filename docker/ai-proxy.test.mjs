import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withConfig(run) {
  const directory = mkdtempSync(join(tmpdir(), "datamorph-proxy-"));
  const path = join(directory, "ai-proxy.conf");
  const env = {
    PATH: process.env.PATH,
    AI_PROXY_CONFIG_PATH: path,
    OPENAI_BASE_URL: "https://example.com/v1",
  };
  try {
    run(path, env);
  } finally {
    rmSync(directory, { recursive: true });
  }
}

const script = new URL("./40-ai-proxy.sh", import.meta.url).pathname;

test("unconfigured site fails closed and replaces an old key on restart", () => {
  withConfig((path, env) => {
    execFileSync("sh", [script], {
      env: { ...env, OPENAI_API_KEY: "test-only-key" },
    });
    execFileSync("sh", [script], { env });
    const config = readFileSync(path, "utf8");
    assert.match(config, /return 503/);
    assert.doesNotMatch(config, /test-only-key|proxy_pass/);
  });
});

test("only chat and models are proxied with server credentials and limits", () => {
  withConfig((path, env) => {
    execFileSync("sh", [script], {
      env: {
        ...env,
        OPENAI_API_KEY: "test-only-key",
        OPENAI_BASE_URL: "https://example.com/v2/",
      },
    });
    const config = readFileSync(path, "utf8");
    assert.equal((config.match(/proxy_pass /g) || []).length, 2);
    assert.match(config, /https:\/\/example\.com\/v2\/chat\/completions;/);
    assert.match(config, /https:\/\/example\.com\/v2\/models;/);
    assert.match(
      config,
      /proxy_set_header Authorization "Bearer test-only-key";/,
    );
    assert.match(config, /limit_req zone=ai_requests/);
    assert.match(config, /limit_conn ai_connections 2/);
    assert.match(config, /proxy_ssl_verify on/);
    assert.match(config, /proxy_buffering off/);
    assert.match(config, /proxy_ignore_client_abort off/);
    assert.match(config, /\$request_method != POST/);
    assert.match(config, /\$request_method != GET/);
    assert.match(config, /return 503/);
    assert.equal(statSync(path).mode & 0o777, 0o600);
  });
});

test("invalid credentials and upstream configuration cannot inject nginx directives", () => {
  for (const invalid of [
    { OPENAI_API_KEY: 'key"; return 200; #' },
    { OPENAI_API_KEY: "key\nheader" },
    { OPENAI_BASE_URL: "https://example.com;/v1" },
    { OPENAI_BASE_URL: "https://$http_host/v1" },
    { OPENAI_BASE_URL: "https://example.com/v1;" },
    { OPENAI_BASE_URL: "http://example.com/v1" },
  ]) {
    withConfig((path, env) => {
      const result = spawnSync("sh", [script], {
        env: { ...env, OPENAI_API_KEY: "test-only-key", ...invalid },
      });
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(readFileSync(path, "utf8"), /proxy_pass/);
    });
  }
});
