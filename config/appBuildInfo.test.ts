import assert from "node:assert/strict";
import test from "node:test";
import { readAppBuildInfo } from "./appBuildInfo";

const sha = "a".repeat(40);
const timestamp = "2026-10-11T03:04:05.000Z";
const options = { readCommit: () => sha, now: () => new Date(timestamp) };

test("development server identifies its checkout without claiming a release", () => {
  assert.deepEqual(readAppBuildInfo({}, "serve", options), {
    version: null,
    commitSha: sha,
    builtAt: null,
  });
});

test("source builds record a UTC build time and work without Git", () => {
  assert.deepEqual(
    readAppBuildInfo({}, "build", { ...options, readCommit: () => null }),
    { version: null, commitSha: null, builtAt: timestamp },
  );
});

test("release builds preserve Actions metadata even when Git is absent", () => {
  const env = {
    APP_VERSION: "1.30.0",
    APP_COMMIT_SHA: sha,
    APP_BUILD_TIME: "2026-10-11T03:04:05Z",
  };
  assert.deepEqual(
    readAppBuildInfo(env, "build", {
      readCommit: () => {
        throw new Error("must not read Git");
      },
    }),
    { version: "1.30.0", commitSha: sha, builtAt: env.APP_BUILD_TIME },
  );
});

test("local release builds can use their Git commit and generated timestamp", () => {
  assert.deepEqual(
    readAppBuildInfo({ APP_VERSION: "1.30.0" }, "build", options),
    {
      version: "1.30.0",
      commitSha: sha,
      builtAt: timestamp,
    },
  );
  assert.throws(
    () =>
      readAppBuildInfo({ APP_VERSION: "1.30.0" }, "build", {
        readCommit: () => null,
      }),
    /requires APP_COMMIT_SHA/,
  );
});

test("empty Docker arguments mean a development build", () => {
  assert.equal(
    readAppBuildInfo(
      { APP_VERSION: "", APP_COMMIT_SHA: "", APP_BUILD_TIME: "" },
      "build",
      options,
    ).version,
    null,
  );
});

test("explicit malformed metadata fails the build", () => {
  for (const version of [
    "v1.2.3",
    "01.2.3",
    "1.2",
    "1.2.3-beta.1",
    "1.2.3\ninjected=true",
    "9007199254740992.0.0",
    " ",
  ]) {
    assert.throws(
      () => readAppBuildInfo({ APP_VERSION: version }, "build", options),
      /APP_VERSION/,
    );
  }
  for (const commit of ["main", "abc1234", "A".repeat(40), `${sha}\n`, " "]) {
    assert.throws(
      () => readAppBuildInfo({ APP_COMMIT_SHA: commit }, "build", options),
      /APP_COMMIT_SHA/,
    );
  }
  for (const time of [
    "invalid",
    "2026-02-30T00:00:00Z",
    "2026-10-11",
    "2026-10-11T24:00:00Z",
    "2026-10-11T00:00:00+08:00",
    " ",
  ]) {
    assert.throws(
      () => readAppBuildInfo({ APP_BUILD_TIME: time }, "build", options),
      /APP_BUILD_TIME/,
    );
  }
  assert.equal(
    readAppBuildInfo({ APP_BUILD_TIME: timestamp }, "build", options).builtAt,
    timestamp,
  );
});
