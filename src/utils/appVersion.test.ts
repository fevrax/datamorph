import assert from "node:assert/strict";
import test from "node:test";
import {
  compareReleaseVersions,
  parseStableVersion,
  releaseUrl,
} from "./appVersion";

test("stable versions compare numerically across patch, minor and major releases", () => {
  for (const [current, latest, result] of [
    ["1.29.1", "1.29.1", "current"],
    ["1.9.0", "1.10.0", "newer"],
    ["1.0.9", "1.0.10", "newer"],
    ["1.99.99", "2.0.0", "newer"],
    ["2.0.0", "1.99.99", "ahead"],
    ["1.10.0", "1.9.0", "ahead"],
  ] as const) {
    assert.equal(compareReleaseVersions(current, latest), result);
  }
  assert.equal(compareReleaseVersions(null, "1.30.0"), "development");
});

test("unsupported versions are not treated as current or outdated", () => {
  for (const value of [
    "v1.2.3",
    "1.2.3-beta.1",
    "01.2.3",
    "1.2.3+build",
    "1.2",
    "9007199254740992.0.0",
  ]) {
    assert.equal(parseStableVersion(value), null);
    assert.throws(() => compareReleaseVersions("1.2.3", value), /Invalid/);
    assert.throws(() => compareReleaseVersions(value, "1.2.3"), /Invalid/);
  }
  assert.equal(
    releaseUrl("1.30.0"),
    "https://github.com/fevrax/datamorph/releases/tag/v1.30.0",
  );
});
