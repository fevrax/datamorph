import { applyTextChanges } from "../components/monacoEditor/textChanges";
import { test } from "node:test";
import assert from "node:assert/strict";
import { executeJsonTask } from "./jsonTasks";
import { executeConversion } from "./conversion";
import { indexStructure } from "./structure";
import {
  detectTokens,
  detectTokensAtPosition,
} from "../components/monacoEditor/decorations/detectors";
import { retainHistory, HISTORY_LIMIT } from "../store/documentHistory";
import { DEFAULT_ENCODING_OPTIONS } from "../utils/encodingConverter";
const precise = "9007199254740993123456789";
test("format/compress/sort/repair preserve exact integer tokens", () => {
  for (const action of ["format", "compress", "sort", "repair"] as const) {
    const result = executeJsonTask({
      action,
      content: `{"z":${precise},"a":1}`,
    });
    assert.ok(result.content?.includes(precise));
  }
});
test("JSON5 formatting never coerces large numbers", () => {
  assert.match(
    executeJsonTask({
      action: "format",
      language: "json5",
      content: `{id:${precise},}`,
    }).content!,
    new RegExp(precise),
  );
});
test("JSON and JSON5 formatting preserve Tab indentation and precise numbers", () => {
  for (const language of ["json", "json5"]) {
    const content =
      language === "json"
        ? `{"id":${precise},"nested":{"value":true}}`
        : `{id:${precise},nested:{value:true}}`;
    const result = executeJsonTask({
      action: "format",
      language,
      content,
      indent: 4,
      insertSpaces: false,
    }).content!;
    assert.match(result, /\n\t"id":/);
    assert.match(result, /\n\t\t"value":/);
    assert.ok(result.includes(precise));
    assert.equal(
      executeJsonTask({
        action: "compress",
        language,
        content,
        insertSpaces: false,
      }).content,
      `{"id":${precise},"nested":{"value":true}}`,
    );
  }
});
test("query preserves lossless values and invalid queries fail", () => {
  assert.match(
    executeJsonTask({
      action: "query",
      content: `{"id":${precise}}`,
      query: "$.id",
    }).content!,
    new RegExp(precise),
  );
  assert.throws(() =>
    executeJsonTask({
      action: "query",
      content: "{}",
      query: "not a valid query !!!",
    }),
  );
});
test("validation supplies positions without throwing", () => {
  const result = executeJsonTask({ action: "validate", content: '{\n"a":\n}' });
  assert.ok(result.error);
  assert.ok(result.error.line >= 1);
});
test("structure index counts direct children and skips braces in strings/comments", () => {
  const regions = indexStructure(
    '{\n"a":[\n1,{"text":"} ]"},3\n],\n/* [ */ "b":{}\n}',
  );
  assert.deepEqual(
    regions.map((x) => [x.type, x.count]),
    [
      ["Object", 1],
      ["Array", 3],
      ["Object", 0],
      ["Object", 2],
    ],
  );
});
test("decorators cover one-line JSON, offsets, unicode, URL and images", () => {
  const text =
    '{"time":1700000000000,"id":1700000000000,"b":"SGVsbG8gd29ybGQ=","u":"\\u4f60\\u597d","url":"%E4%BD%A0","image":"https://example.com/a.png"}';
  const tokens = detectTokens(text, 42);
  assert.deepEqual(
    new Set(tokens.map((t) => t.kind)),
    new Set(["timestamp", "base64", "unicode", "url", "image"]),
  );
  assert.equal(tokens.filter((t) => t.kind === "timestamp").length, 1);
  for (const token of tokens)
    assert.equal(text.slice(token.start - 42, token.end - 42), token.raw);
});
test("decorator scan is bounded and does not treat property names as values", () => {
  assert.equal(detectTokens('{"SGVsbG8gd29ybGQ=":false}').length, 0);
  assert.ok(
    detectTokens("[" + Array(1000).fill('"SGVsbG8gd29ybGQ="').join(",") + "]")
      .length <= 250,
  );
});
test("history preserves full large snapshots, count and byte budget", () => {
  const big = { content: "x".repeat(1_000_001) };
  assert.equal(retainHistory([big])[0].content.length, 1_000_001);
  assert.equal(
    retainHistory(
      Array.from({ length: 70 }, (_, i) => ({ content: String(i) })),
    ).length,
    HISTORY_LIMIT,
  );
  const input = [{ content: "你好" }, { content: "abc" }, { content: "d" }];
  assert.deepEqual(retainHistory(input, 7), [input[0], input[2]]);
});
test("all supported data formats preserve exact tokens or explicitly reject unsupported values", async () => {
  for (const to of ["json", "json5", "yaml"]) {
    const encoded = await executeConversion({
      action: "convert",
      content: `{"id":${precise}}`,
      from: "json",
      to,
    });
    const decoded = await executeConversion({
      action: "convert",
      content: encoded.content,
      from: to,
      to: "json",
    });
    assert.ok(decoded.content.includes(precise), to);
  }
  await assert.rejects(() =>
    executeConversion({
      action: "convert",
      content: `{"id":${precise}}`,
      from: "json",
      to: "xml",
    }),
  );
  await assert.rejects(() =>
    executeConversion({
      action: "convert",
      content: `{"id":${precise}}`,
      from: "json",
      to: "toml",
    }),
  );
});
test("key collisions reject without discarding input", async () => {
  await assert.rejects(
    () =>
      executeConversion({
        action: "keys",
        content: '{"first_name":1,"firstName":2}',
        format: "camel",
      }),
    /冲突/,
  );
});
test("encoding conversions run exact round trips for every encoding", async () => {
  for (const encoding of [
    "base64",
    "base64url",
    "url",
    "unicode",
    "hex",
    "binary",
    "text",
  ] as const) {
    const content = "你好 👋 & + 100%";
    const options = DEFAULT_ENCODING_OPTIONS;
    const result = await executeConversion({
      action: "encode",
      content,
      encoding,
      options,
    });
    assert.equal(
      (
        await executeConversion({
          action: "decode",
          content: result.content,
          encoding,
          options,
        })
      ).content,
      content,
    );
  }
});
test("invalid UTF-8 and malformed encoded input fail explicitly", async () => {
  await assert.rejects(
    () =>
      executeConversion({
        action: "decode",
        content: "ff",
        encoding: "hex",
        options: DEFAULT_ENCODING_OPTIONS,
      }),
    /UTF-8/,
  );
});

test("long string values are decoded fully on explicit hover only", () => {
  const raw = Buffer.from("hello world ".repeat(3000)).toString("base64");
  const text = '{"long":"' + raw + '","id":"1700000000000"}';
  assert.equal(detectTokens(text).filter((t) => t.kind === "base64").length, 0);
  const result = detectTokensAtPosition(text, 24000);
  assert.equal(result[0].decoded, "hello world ".repeat(3000));
  assert.equal(text.slice(result[0].start, result[0].end), raw);
  assert.equal(detectTokensAtPosition(text, text.length - 6).length, 0);
});

test("type generation supports every listed target language", async () => {
  for (const language of [
    "go",
    "typescript",
    "javascript",
    "java",
    "csharp",
    "python",
    "swift",
    "kotlin",
    "dart",
    "ruby",
    "rust",
    "php",
    "plaintext",
  ]) {
    const result = await executeConversion({
      action: "type",
      content: '{"name":"Alice","count":1,"active":true}',
      language,
    });
    assert.ok(result.content.includes("name"), language);
  }
});
test("background table exports retain precise integers and XLSX structure", async () => {
  const content = '[{"id":900719925474099312345}]';
  const csv = await executeConversion({
    action: "export",
    content,
    format: "csv",
  });
  assert.ok(csv.content.includes("900719925474099312345"));
  const xlsx = await executeConversion({
    action: "export",
    content,
    format: "xlsx",
  });
  assert.ok(xlsx.buffer && xlsx.buffer.byteLength > 100);
  assert.equal(new Uint8Array(xlsx.buffer)[0], 0x50);
});

test("timestamp decorators detect final values on separate lines", () => {
  assert.equal(
    detectTokens('"time":1700000000000').filter((t) => t.kind === "timestamp")
      .length,
    1,
  );
  assert.equal(detectTokens("1700000000000").length, 1);
  assert.equal(detectTokens('"id":1700000000000').length, 0);
});

test("incremental text edits preserve UTF-16 offsets and simultaneous selections", () => {
  assert.equal(
    applyTextChanges("a😀b中文c", [
      { rangeOffset: 1, rangeLength: 2, text: "你好" },
      { rangeOffset: 6, rangeLength: 1, text: "!" },
    ]),
    "a你好b中文!",
  );
  assert.equal(
    applyTextChanges("old", [{ rangeOffset: 0, rangeLength: 3, text: "new" }]),
    "new",
  );
});
