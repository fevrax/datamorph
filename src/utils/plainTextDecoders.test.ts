import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlainTextTokens } from "../components/monacoEditor/decorations/detectors";

test("plain text recognizes complete timestamp values with accurate offsets", () => {
  const line = 'event_time: 1793145600  trigger_time="1793145599525" done';
  const tokens = detectPlainTextTokens(line, 12, "UTC");
  assert.deepEqual(
    tokens.map(({ kind, raw, decoded }) => [kind, raw, decoded]),
    [
      ["timestamp", "1793145600", "2026-10-28 00:00:00"],
      ["timestamp", "1793145599525", "2026-10-27 23:59:59"],
    ],
  );
  for (const { raw, start, end } of tokens)
    assert.equal(line.slice(start - 12, end - 12), raw);
  for (const line of [
    "ID: 1793145600",
    "size=1793145600",
    "tour_id: /match/1793145599/12337/531",
    "time: 1793145600.12",
    "time: 17931456001234",
    "time: abc1793145600",
  ])
    assert.equal(
      detectPlainTextTokens(line).some(({ kind }) => kind === "timestamp"),
      false,
      line,
    );
  const hovered = detectPlainTextTokens(
    line,
    0,
    "UTC",
    line.indexOf("1793145599525"),
  );
  assert.deepEqual(
    hovered.map(({ raw }) => raw),
    ["1793145599525"],
  );
});

test("plain text also recognizes unquoted Base64, Unicode, URL and image values", () => {
  const tokens = detectPlainTextTokens(
    "base64: SGVsbG8= unicode: \\u4f60\\u597d url: hello%20world image: https://example.com/a.png",
  );
  assert.deepEqual(
    tokens.map(({ kind, decoded }) => [kind, decoded]),
    [
      ["base64", "Hello"],
      ["unicode", "你好"],
      ["url", "hello world"],
      ["image", "https://example.com/a.png"],
    ],
  );
});
