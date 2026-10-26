import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { applyTextChanges } from "../components/monacoEditor/textChanges";
import {
  SMART_LIMITS,
  SmartDocument,
  indexSmartDocument,
  parsePreviewColor,
} from "./smartDisplay";

const all = { embeddedJson: true, color: true, summary: true };
const none = { embeddedJson: false, color: false, summary: false };
function hoverValue(source: string, name = "payload") {
  const doc = new SmartDocument(source);
  const offset = source.indexOf(":", source.indexOf(name)) + 1;
  const entry = doc
    .getIndex()
    .entries.find((item) => item.kind === "string" && item.start >= offset)!;
  return entry ? doc.hover(entry.start + 1, all) : [];
}

test("embedded JSON is hover-only and formats objects and arrays without rounding numeric literals or touching source", () => {
  for (const raw of [
    '{"id":900719925474099312345,"name":"张三"}',
    '[1,{"x":true}]',
  ]) {
    const source = JSON.stringify({ payload: raw });
    const doc = new SmartDocument(source);
    assert.deepEqual(doc.visible([{ start: 0, end: source.length }], all), []);
    const hint = hoverValue(source).find(
      (item) => item.kind === "embeddedJson",
    )!;
    assert.ok(hint.content?.includes("\n"));
    if (raw.includes("900719"))
      assert.ok(hint.content?.includes("900719925474099312345"));
    assert.equal(JSON.parse(source).payload, raw);
  }
});
test("invalid, scalar and doubly encoded JSON do not become expandable JSON", () => {
  for (const raw of [
    '{"a":}',
    "[1,]",
    "123",
    "null",
    '"hello"',
    JSON.stringify('{"x":1}'),
  ]) {
    const source = JSON.stringify({ payload: raw });
    assert.equal(
      hoverValue(source).filter((item) => item.kind === "embeddedJson").length,
      0,
    );
  }
});
test("JSON5 single quotes, comments, escaped quotes and colon-like string contents are indexed correctly", () => {
  const source = `{ /* [bad] */ items: [1, {x: 'a:b,c'}, 'hello',], payload: '{"x":1}', '#fff' /* key */ : 4, color: '#abc' }`;
  const doc = new SmartDocument(source);
  assert.equal(doc.getIndex().entries[0].count, 4);
  assert.equal(
    doc.getIndex().entries.find((entry) => entry.start === source.indexOf("[1"))
      ?.count,
    3,
  );
  assert.ok(hoverValue(source).some((item) => item.kind === "embeddedJson"));
  assert.equal(
    doc
      .visible([{ start: 0, end: source.length }], all)
      .filter((item) => item.kind === "color").length,
    1,
  );
});
test("summaries count direct children only and appear only for collapsed multiline containers", () => {
  const text =
    '{\n"a": [\n1, {"nested":[1,2]}, null\n],\n"b": {\n},\n"c": [\n]\n}';
  const doc = new SmartDocument(text);
  const range = [{ start: 0, end: text.length }];
  assert.deepEqual(doc.visible(range, all), []);
  const starts = [
    0,
    text.indexOf("[\n"),
    text.indexOf("{\n", 1),
    text.indexOf("[\n", text.indexOf('"c"')),
  ];
  const collapsed = starts.map((start) => ({
    start,
    end: text.indexOf("\n", start),
  }));
  const hints = doc.visible(range, all, collapsed);
  assert.deepEqual(
    hints.map((hint) => hint.label),
    ["Object { 3 }", "Array [ 3 ]", "Object { 0 }", "Array [ 0 ]"],
  );
  assert.deepEqual(doc.hover(0, all), []);
  assert.deepEqual(doc.visible(range, none, collapsed), []);
  assert.deepEqual(doc.visible(range, all), []);
  assert.equal(doc.indexBuilds, 1);
  assert.equal(
    new SmartDocument('{\n"a": [1,2').visible(range, all, collapsed).length,
    0,
  );
});
test("a shared opening line produces one summary for the innermost folded container", () => {
  const text = '{"items": [\n  1, 2, 3\n], "other": true}';
  const doc = new SmartDocument(text);
  const hints = doc.visible([{ start: 0, end: text.length }], all, [
    { start: 0, end: text.indexOf("\n") },
  ]);
  assert.deepEqual(
    hints.map((hint) => hint.label),
    ["Array [ 3 ]"],
  );
});
test("ordinary, long, multiline and oversized strings never produce content summaries", () => {
  for (const value of [
    "plain text",
    "你好😀".repeat(40),
    "a\nb",
    "a\rb",
    "a\r\nb",
    "x".repeat(SMART_LIMITS.value + 10),
  ]) {
    const source = JSON.stringify({ payload: value });
    assert.deepEqual(hoverValue(source), []);
    assert.deepEqual(
      new SmartDocument(source).visible(
        [{ start: 0, end: source.length }],
        all,
      ),
      [],
    );
  }
});
test("HEX, alpha, RGB percentages and HSL angle units produce safe swatches", () => {
  for (const value of [
    "#abc",
    "#abcd",
    "#AABBCC",
    "#11223344",
    "rgb(255, 0, 128)",
    "rgba(0, 0, 0, 0.5)",
    "rgb(100% 0% 0% / 50%)",
    "hsl(0, 100%, 50%)",
    "hsl(0.5turn 100% 50% / .5)",
    "hsl(200grad, 100%, 50%)",
  ])
    assert.ok(parsePreviewColor(value), value);
  assert.equal(parsePreviewColor("hsl(0, 100%, 50%)"), "rgba(255, 0, 0, 1)");
  assert.equal(
    parsePreviewColor("hsl(0.5turn 100% 50% / .5)"),
    "rgba(0, 255, 255, 0.5)",
  );
  for (const value of [
    "#12345",
    "rgb(999,0,0)",
    "rgb(0,0,0);background:url(x)",
    "rgb(1 2 3 0.5)",
    "hsl(0, 120%, 50%)",
    "rgba(1,2,3,2)",
    "url(https://example.com)",
    "var(--color)",
    "#fff trailing",
    "rgb(1deg,2,3)",
  ])
    assert.equal(parsePreviewColor(value), undefined, value);
});

test("JSON5 escaped colors remain recognizable", () => {
  const json5 = String.raw`{payload: "\x23abc"}`;
  assert.equal(hoverValue(json5)[0].color, "#abc");
});

test("wrapped JSON strings have no inline hint and remain available on hover", () => {
  const source = JSON.stringify({
    payload: JSON.stringify({ text: "x".repeat(20000) }),
  });
  const doc = new SmartDocument(source);
  const hints = doc.visible([{ start: 15000, end: 16000 }], all);
  assert.deepEqual(hints, []);
  assert.ok(doc.hover(15000, all)[0].content!.length > 20000);
});
test("preview and decoration payloads are bounded; full JSON is available only on hover", () => {
  const source = JSON.stringify({
    payload: JSON.stringify({ text: "x".repeat(10000) }),
  });
  const doc = new SmartDocument(source);
  const visible = doc.visible([{ start: 0, end: source.length }], all);
  assert.ok(
    visible.every(
      (item) => item.content === undefined && item.preview === undefined,
    ),
  );
  const hint = hoverValue(source).find((item) => item.kind === "embeddedJson")!;
  assert.equal(hint.preview?.length, SMART_LIMITS.preview);
  assert.ok(hint.truncated);
  assert.ok(hint.content!.length > SMART_LIMITS.preview);
  const enormous = JSON.stringify({
    payload: "x".repeat(SMART_LIMITS.value + 10),
  });
  assert.deepEqual(hoverValue(enormous), []);
  const many = new SmartDocument(
    JSON.stringify([
      ...Array.from({ length: 500 }, () => '{"x":1}'),
      ...Array.from({ length: 1000 }, () => ({ color: "#abc" })),
    ]),
  );
  assert.equal(
    many.visible([{ start: 0, end: many.text.length }], all).length,
    SMART_LIMITS.decorations,
  );
  assert.ok(
    many
      .visible([{ start: 0, end: many.text.length }], all)
      .every((hint) => hint.kind === "color"),
  );
});
test("scrolling reuses the index, settings are respected, and incremental edits invalidate cached content", () => {
  const doc = new SmartDocument('{"color":"#abc","items":[1,2]}');
  doc.visible([{ start: 0, end: 10 }], all);
  doc.visible([{ start: 11, end: 100 }], all);
  assert.equal(doc.indexBuilds, 1);
  assert.deepEqual(doc.visible([{ start: 0, end: 100 }], none), []);
  const offset = doc.text.indexOf("#abc");
  doc.update(
    applyTextChanges(doc.text, [
      { rangeOffset: offset, rangeLength: 4, text: "#ff0000" },
    ]),
  );
  assert.equal(doc.hover(offset, all)[0].color, "#ff0000");
  assert.equal(doc.indexBuilds, 2);
});
test("defensive depth and document limits avoid recursive overflow or partial parent counts", () => {
  const deep = "[".repeat(10000) + "0" + "]".repeat(10000);
  const index = indexSmartDocument(deep);
  assert.ok(index.limited);
  assert.equal(index.entries.length, 0);
  assert.ok(indexSmartDocument(" ".repeat(SMART_LIMITS.document + 1)).limited);
});
test("multi-megabyte indexing stays off the UI path and repeated viewport requests use bounded payloads", () => {
  const row = {
    id: 123456789,
    color: "#1677ff",
    payload: '{"ok":true}',
    text: "中文 text ".repeat(8),
  };
  const text = JSON.stringify(
    Array.from({ length: 20000 }, () => row),
    null,
    2,
  );
  const doc = new SmartDocument(text);
  const start = performance.now();
  const initial = doc.visible([{ start: 0, end: 6000 }], all);
  const indexedMs = performance.now() - start;
  const scrollStart = performance.now();
  for (let i = 0; i < 100; i++)
    doc.visible([{ start: i * 20000, end: i * 20000 + 6000 }], all);
  const scrollMs = performance.now() - scrollStart;
  assert.equal(doc.indexBuilds, 1);
  assert.ok(initial.length <= SMART_LIMITS.decorations);
  assert.ok(JSON.stringify(initial).length < 50000);
  // Generous regression ceilings, not a machine-dependent frame-time claim.
  assert.ok(indexedMs < 5000, `index ${indexedMs}ms`);
  assert.ok(scrollMs < 3000, `100 viewports ${scrollMs}ms`);
  console.log(
    `smart-display benchmark: ${(Buffer.byteLength(text) / 1048576).toFixed(2)} MiB, index ${indexedMs.toFixed(1)}ms, 100 cached viewports ${scrollMs.toFixed(1)}ms`,
  );
});
