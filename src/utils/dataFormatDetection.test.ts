import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDataFormat, stripJsonComments } from "./dataFormatDetection";
import {
  DATA_FORMATS,
  documentDownloadName,
  formatFromFilename,
} from "./dataFormats";
import { executeJsonTask } from "../workers/jsonTasks";

const samples = {
  proto: 'syntax="proto3";message User{string name=1;}',
  css: ".card{color:red;margin:0}",
  scss: "$primary:red;.card{color:$primary;&:hover{color:blue}}",
  less: "@primary:red;.card{color:@primary;}",
  html: "<!doctype html><html><body><input disabled></body></html>",
  sql: "-- query\nselect id,name from users where active=true;",
  javascript: "function hello(){if(true){return 1;}}",
  typescript: "interface User{id:number;name:string}",
  markdown: "# Title\n\nSome text.",
  json: '{"name":"Ada","active":true}',
  jsonc: '{"name":"Ada", // comment\n"active":true,}',
  json5: "{name:'Ada', active:true}",
  ndjson: '{"a":1}\n{"a":2}',
  xml: '<?xml version="1.0"?><users><name>Ada</name></users>',
  toml: '[user]\nname = "Ada"\nactive = true',
  ini: "[user]\nname = Ada\nactive = yes",
  yaml: "user:\n  name: Ada\n  active: true",
  csv: "name,age\nAda,42",
  tsv: "name\tage\nAda\t42",
} as const;
for (const [language, sample] of Object.entries(samples))
  test(`detect ${language} without filename`, () =>
    assert.equal(detectDataFormat(sample), language));
test("extensions take priority, including empty files, aliases and URL queries", () => {
  for (const format of DATA_FORMATS)
    for (const extension of format.extensions)
      assert.equal(
        detectDataFormat(samples.yaml, "sample." + extension.toUpperCase()),
        format.id,
      );
  assert.equal(detectDataFormat("", "empty.yml"), "yaml");
  assert.equal(formatFromFilename("data.jsonl?download=1"), "ndjson");
  assert.equal(detectDataFormat(samples.yaml, "unknown.txt"), "yaml");
});
test("NDJSON accepts all JSON values, not only objects", () => {
  assert.equal(detectDataFormat('42\ntrue\n"hello"\nnull'), "ndjson");
});
test("JSON subsets are distinguished without mistaking string contents for syntax", () => {
  assert.equal(
    detectDataFormat('{"url":"https://host/a", "text":"a,}"}'),
    "json",
  );
  assert.equal(
    detectDataFormat('{"url":"https://host/a", /* block */ "text":"a,}"}'),
    "jsonc",
  );
  assert.equal(detectDataFormat('{"text":"a,}"} // suffix'), "jsonc");
  assert.equal(
    stripJsonComments('{"x":"/* keep */"} // erase'),
    '{"x":"/* keep */"}         ',
  );
});
test("YAML needs structure and plain text uses the JSON fallback", () => {
  assert.equal(detectDataFormat("user: {name: Ada}"), "yaml");
  assert.equal(detectDataFormat('<?xml version="1.0"?><html/>'), "xml");
  for (const text of [
    "hello world",
    "hello\nworld",
    "https://host/path",
    "a,b",
    "",
    " \n ",
  ])
    assert.equal(detectDataFormat(text), "json");
  assert.equal(detectDataFormat('["a","b"]'), "json");
  assert.equal(detectDataFormat("- a\n- b"), "yaml");
  assert.equal(detectDataFormat('a = "value"'), "toml");
  assert.equal(detectDataFormat("a = value"), "ini");
});
test("quoted delimiter fields, embedded newlines, escaped quotes and column counts", () => {
  assert.equal(detectDataFormat('name,note\nAda,"hello,\nworld"'), "csv");
  assert.equal(detectDataFormat('name,note\nAda,"say ""hi"""'), "csv");
  for (const text of [
    "a,b\nc,d,e",
    'a,b\nc,"unfinished',
    'a,b\nc,"text"garbage',
  ])
    assert.equal(detectDataFormat(text), "json");
});
test("malformed YAML blocks retain their language even on the first paste", () => {
  const source =
    "data:\n  database:\n     driver: mysql\n    # local database\n    source: example";
  for (const prefix of ["", "# Configuration\n", "--- # Configuration\n"])
    assert.equal(detectDataFormat(prefix + source, undefined, "json"), "yaml");
  assert.equal(detectDataFormat("items:\n  - [unfinished"), "yaml");
  assert.equal(detectDataFormat("服务:\n  地址: [unfinished"), "yaml");
  for (const text of [
    '{\n  "data": {\n    "driver": "mysql",\n',
    "message User {\n  string name = 1;\n",
    "# Notes\n\n```yaml\ndata:\n  source: [unfinished\n```",
    "hello\nhttps://host/path",
  ])
    assert.notEqual(detectDataFormat(text), "yaml");
});
test("incomplete edits retain their language, clearing and unrelated text reset it", () => {
  assert.equal(detectDataFormat("message User {", undefined, "proto"), "proto");
  assert.equal(detectDataFormat("{name:", undefined, "json5"), "json5");
  assert.equal(detectDataFormat("<root>", undefined, "xml"), "xml");
  assert.equal(detectDataFormat("", undefined, "yaml"), "json");
  assert.equal(detectDataFormat("plain words", undefined, "yaml"), "json");
});

test("Protobuf headers and definitions do not fall through to TOML, JavaScript or CSS", () => {
  for (const source of [
    '/* schema */\nsyntax = "proto2";',
    'edition = "2023"; message User {}',
    'import "google/protobuf/timestamp.proto";',
    'import public "shared.proto";',
    "package example.api;",
    "message User { string name = 1; }",
    "enum State { UNKNOWN = 0; }",
    "service Users { rpc Get(User) returns (User); }",
  ])
    assert.equal(detectDataFormat(source), "proto");
  assert.equal(detectDataFormat('syntax = "custom"'), "toml");
  assert.equal(detectDataFormat('import "module.js";'), "javascript");
});
test("download preserves supplied names and uses detected format for untitled documents", () => {
  assert.equal(documentDownloadName("未命名", "yaml"), "未命名.yaml");
  assert.equal(documentDownloadName("未命名.json", "yaml"), "未命名.yaml");
  assert.equal(documentDownloadName("未命名", "json", "未命名"), "未命名");
  assert.equal(
    documentDownloadName("data.json", "yaml", "data.json"),
    "data.json",
  );
});
test("JSON operations cannot process another data format, including keyboard-triggered jobs", () => {
  for (const format of DATA_FORMATS.filter((f) => !f.jsonOperations)) {
    assert.throws(
      () =>
        executeJsonTask({
          action: "format",
          language: format.id,
          content: "{}",
        }),
      /暂不支持/,
    );
    assert.throws(
      () =>
        executeJsonTask({
          action: "repair",
          language: format.id,
          content: "{}",
        }),
      /暂不支持/,
    );
    assert.deepEqual(
      executeJsonTask({
        action: "validate",
        language: format.id,
        content: "{}",
      }),
      {},
    );
  }
});
