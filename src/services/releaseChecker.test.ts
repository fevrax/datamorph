import assert from "node:assert/strict";
import test from "node:test";
import { createReleaseChecker, ReleaseCheckError } from "./releaseChecker";
import { LATEST_RELEASE_API_URL } from "../utils/appVersion";

const release = (tag = "v1.30.0") =>
  Response.json({ tag_name: tag, draft: false, prerelease: false });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

test("checking is manual, anonymous and caches successful results for five minutes", async () => {
  let calls = 0;
  let now = 1_000;
  const checker = createReleaseChecker({
    now: () => now,
    fetcher: async (url, init) => {
      calls++;
      assert.equal(url, LATEST_RELEASE_API_URL);
      assert.equal(init?.credentials, "omit");
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return release();
    },
  });
  assert.equal(calls, 0);
  const first = await checker.check();
  assert.deepEqual(first, { version: "1.30.0", checkedAt: 1_000 });
  now += 299_999;
  assert.equal(await checker.check(), first);
  assert.equal(calls, 1);
  now++;
  assert.deepEqual(await checker.check(), {
    version: "1.30.0",
    checkedAt: now,
  });
  assert.equal(calls, 2);
});

test("simultaneous checks share a transport and subscribers cancel independently", async () => {
  const response = deferred<Response>();
  let calls = 0;
  let transport!: AbortSignal;
  const checker = createReleaseChecker({
    fetcher: async (_url, init) => {
      calls++;
      transport = init!.signal!;
      return response.promise;
    },
  });
  const controller = new AbortController();
  const first = checker.check(controller.signal);
  const second = checker.check();
  const cancelled = assert.rejects(first, { name: "AbortError" });
  controller.abort();
  await cancelled;
  assert.equal(transport.aborted, false);
  response.resolve(release());
  assert.equal((await second).version, "1.30.0");
  assert.equal(calls, 1);
});

test("leaving the page aborts the last subscriber and cannot cache a late response", async () => {
  const response = deferred<Response>();
  let calls = 0;
  let transport!: AbortSignal;
  const checker = createReleaseChecker({
    fetcher: async (_url, init) => {
      calls++;
      transport = init!.signal!;
      return calls === 1 ? response.promise : release("v1.31.0");
    },
  });
  const controller = new AbortController();
  const pending = checker.check(controller.signal);
  const cancelled = assert.rejects(pending, { name: "AbortError" });
  controller.abort();
  await cancelled;
  assert.equal(transport.aborted, true);
  const fresh = await checker.check();
  response.resolve(release("v9.9.9"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await checker.check(), fresh);
  assert.equal(fresh.version, "1.31.0");
  assert.equal(calls, 2);
});

test("timeout aborts transport even if a fetch implementation ignores cancellation", async () => {
  let transport!: AbortSignal;
  const checker = createReleaseChecker({
    timeoutMs: 10,
    fetcher: async (_url, init) => {
      transport = init!.signal!;
      return new Promise<Response>(() => {});
    },
  });
  await assert.rejects(
    checker.check(),
    (error: unknown) =>
      error instanceof ReleaseCheckError && error.kind === "timeout",
  );
  assert.equal(transport.aborted, true);
});

test("offline and already cancelled checks make no request", async () => {
  let calls = 0;
  const checker = createReleaseChecker({
    isOnline: () => false,
    fetcher: async () => {
      calls++;
      return release();
    },
  });
  await assert.rejects(
    checker.check(),
    (error: unknown) =>
      error instanceof ReleaseCheckError && error.kind === "offline",
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(checker.check(controller.signal), {
    name: "AbortError",
  });
  assert.equal(calls, 0);
});

test("HTTP, malformed responses and unsupported releases give retryable errors", async () => {
  for (const [response, kind] of [
    [new Response("", { status: 429 }), "rate-limit"],
    [
      new Response("", { status: 403, headers: { "retry-after": "60" } }),
      "rate-limit",
    ],
    [
      new Response("", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      }),
      "rate-limit",
    ],
    [new Response("", { status: 403 }), "http"],
    [new Response("", { status: 404 }), "not-found"],
    [new Response("", { status: 500 }), "http"],
    [new Response("not json"), "invalid-response"],
    [Response.json(null), "invalid-response"],
    [
      Response.json({ tag_name: "v1.30.0", draft: false, prerelease: true }),
      "invalid-response",
    ],
    [
      Response.json({ tag_name: "v1.30.0", draft: true, prerelease: false }),
      "invalid-response",
    ],
    [release("v1.30.0-beta.1"), "invalid-response"],
    [release("1.30.0"), "invalid-response"],
    [release("v01.30.0"), "invalid-response"],
  ] as const) {
    let calls = 0;
    const checker = createReleaseChecker({
      fetcher: async () => (++calls === 1 ? response : release()),
    });
    await assert.rejects(
      checker.check(),
      (error: unknown) =>
        error instanceof ReleaseCheckError && error.kind === kind,
    );
    assert.equal((await checker.check()).version, "1.30.0");
    assert.equal(calls, 2);
  }
});

test("network errors remain retryable and are not cached", async () => {
  let calls = 0;
  const checker = createReleaseChecker({
    fetcher: async () => {
      if (++calls === 1) throw new TypeError("Failed to fetch");
      return release();
    },
  });
  await assert.rejects(
    checker.check(),
    (error: unknown) =>
      error instanceof ReleaseCheckError && error.kind === "network",
  );
  assert.equal((await checker.check()).version, "1.30.0");
  assert.equal(calls, 2);
});
