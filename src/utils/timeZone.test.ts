import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTimestamp,
  getLocalTimeZone,
  normalizeTimeZone,
  resolveTimeZone,
} from "./timeZone";
import {
  detectTokens,
  detectTokensAtPosition,
} from "../components/monacoEditor/decorations/detectors";

test("seconds and milliseconds represent the same instant across time zones", () => {
  assert.equal(formatTimestamp("1704067200", "UTC"), "2024-01-01 00:00:00");
  assert.equal(
    formatTimestamp("1704067200000", "Asia/Shanghai"),
    "2024-01-01 08:00:00",
  );
  assert.equal(
    formatTimestamp("1704067200", "America/New_York"),
    "2023-12-31 19:00:00",
  );
  assert.equal(
    formatTimestamp("1704067200", "Asia/Kathmandu"),
    "2024-01-01 05:45:00",
  );
});

test("daylight saving is based on the timestamp's date", () => {
  const stamp = (date: string) => String(Date.parse(date));
  assert.equal(
    formatTimestamp(stamp("2024-03-10T06:59:59Z"), "America/New_York"),
    "2024-03-10 01:59:59",
  );
  assert.equal(
    formatTimestamp(stamp("2024-03-10T07:00:00Z"), "America/New_York"),
    "2024-03-10 03:00:00",
  );
  assert.equal(
    formatTimestamp(stamp("2024-07-01T00:00:00Z"), "America/New_York"),
    "2024-06-30 20:00:00",
  );
});

test("missing or invalid persisted zones fall back to the local preference", () => {
  for (const input of [undefined, null, "", "Invalid/Zone", 8]) {
    assert.equal(normalizeTimeZone(input), "local");
  }
  assert.equal(resolveTimeZone("local"), getLocalTimeZone());
  assert.equal(
    formatTimestamp("1704067200"),
    formatTimestamp("1704067200", getLocalTimeZone()),
  );
  assert.equal(
    formatTimestamp("1704067200", "invalid"),
    formatTimestamp("1704067200"),
  );
  assert.equal(formatTimestamp("invalid", "UTC"), "invalid");
});

test("following local time remains dynamic when the device's time zone changes", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Asia/Tokyo";
    assert.equal(formatTimestamp("1704067200", "local"), "2024-01-01 09:00:00");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(formatTimestamp("1704067200", "local"), "2023-12-31 16:00:00");
    assert.equal(formatTimestamp("1704067200", "UTC"), "2024-01-01 00:00:00");
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("inline and hover detectors share the chosen time zone for strings and numbers", () => {
  const source =
    '{"created":1704067200,"updated":"1704067200000","id":1704067200}';
  for (const [zone, expected] of [
    ["UTC", "2024-01-01 00:00:00"],
    ["Asia/Tokyo", "2024-01-01 09:00:00"],
  ]) {
    const tokens = detectTokens(source, 0, 12000, zone).filter(
      (t) => t.kind === "timestamp",
    );
    assert.equal(tokens.length, 2);
    for (const token of tokens) {
      assert.equal(token.decoded, expected);
      const hovered = detectTokensAtPosition(
        source,
        token.start + 2,
        zone,
      ).find((t) => t.kind === "timestamp");
      assert.equal(hovered?.decoded, expected);
    }
  }
});
