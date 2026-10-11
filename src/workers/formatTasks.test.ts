import { test } from "node:test";
import assert from "node:assert/strict";
import { executeFormatTask } from "./formatTasks";
import {
  supportsFormatting,
  supportsJsonOperations,
} from "../utils/dataFormats";

test("SQL formatting preserves comments, literals, placeholders and large numbers", async () => {
  const content =
    "-- keep\nselect id,'from where' as label from users where id=9007199254740993123 and name=?;";
  const result = await executeFormatTask({
    action: "format-code",
    language: "sql",
    content,
    indent: 4,
  });
  assert.match(result.content, /\n {4}id/);
  for (const token of ["-- keep", "'from where'", "9007199254740993123", "?"])
    assert.ok(result.content.includes(token));
  assert.equal(
    (
      await executeFormatTask({
        action: "format-code",
        language: "sql",
        content: result.content,
        indent: 4,
      })
    ).content,
    result.content,
  );
});

test("JSONC retains comments, exact numeric tokens and quoted strings", async () => {
  const { content } = await executeFormatTask({
    action: "format-code",
    language: "jsonc",
    content: '{\n"id":9007199254740993123,/* keep */"url":"https://host/a",}',
    indent: 4,
  });
  assert.match(content, /\n {4}"id"/);
  assert.ok(content.includes("9007199254740993123"));
  assert.ok(content.includes("/* keep */"));
  assert.ok(content.includes("https://host/a"));
});

test("YAML and Markdown preserve comments and code blocks", async () => {
  const yaml = await executeFormatTask({
    action: "format-code",
    language: "yaml",
    content: '# keep\nuser: {id: 9007199254740993123,name: "Ada"}',
  });
  assert.ok(yaml.content.includes("# keep"));
  assert.ok(yaml.content.includes("9007199254740993123"));
  const markdown = await executeFormatTask({
    action: "format-code",
    language: "markdown",
    content: "# Title\n\n```js\nconst x={a:1};\n```",
  });
  assert.ok(markdown.content.includes("const x={a:1};"));
});

test("invalid and unsupported input rejects without producing replacement text", async () => {
  for (const [language, content] of [
    ["sql", "select 'unfinished"],
    ["yaml", "a: ["],
    ["jsonc", '{"a":'],
  ])
    await assert.rejects(
      executeFormatTask({ action: "format-code", language, content }),
    );
  await assert.rejects(
    executeFormatTask({
      action: "format-code",
      language: "python",
      content: "x=1",
    }),
    /暂不支持/,
  );
});

test("YAML indentation errors reject until sibling keys are aligned", async () => {
  const source =
    "data:\n  database:\n     driver: mysql\n    # local database\n    source: example\n";
  await assert.rejects(
    executeFormatTask({
      action: "format-code",
      language: "yaml",
      content: source,
    }),
    /All collection items must start at the same column/,
  );
  const corrected = source.replace("     driver:", "    driver:");
  const result = await executeFormatTask({
    action: "format-code",
    language: "yaml",
    content: corrected,
  });
  assert.equal(result.content, corrected);
});

test("formatting is independent of JSON-only operations", () => {
  for (const language of [
    "css",
    "scss",
    "less",
    "html",
    "sql",
    "javascript",
    "typescript",
    "yaml",
    "jsonc",
    "markdown",
    "proto",
  ]) {
    assert.ok(supportsFormatting(language));
    assert.equal(supportsJsonOperations(language), false);
  }
  for (const language of ["csv", "tsv", "ini", "python"])
    assert.equal(supportsFormatting(language), false);
});

const loadProto = () => import("@wasm-fmt/clang-format");
test("Protobuf formats nested definitions, maps, oneofs and streaming RPCs without resolving imports", async () => {
  const source =
    'syntax="proto3";import "z.proto";import "a.proto";message User{enum State{UNKNOWN=0;ACTIVE=1;}map<string,int64> ids=1;oneof contact{string email=2;string phone=3;}}service Users{rpc Get(stream User)returns(stream User);}';
  const input = {
    action: "format-code",
    language: "proto",
    content: source,
  } as const;
  const { content } = await executeFormatTask(input, loadProto);
  assert.match(content, /message User \{\n {2}enum State \{/);
  assert.ok(content.includes("map<string, int64> ids = 1;"));
  assert.ok(content.includes("rpc Get(stream User) returns (stream User);"));
  assert.ok(content.indexOf('"z.proto"') < content.indexOf('"a.proto"'));
  assert.equal(
    (await executeFormatTask({ ...input, content }, loadProto)).content,
    content,
  );
});

test("proto2 formatting preserves exact defaults, strings, comments and field numbers", async () => {
  const { content } = await executeFormatTask(
    {
      action: "format-code",
      language: "proto",
      indent: 4,
      content:
        'syntax="proto2";\n// keep this comment\nmessage User{optional int64 id=1[default=-9223372036854775808];/* keep { } */optional string url=2[default="https://host/{x};"];reserved 5 to 9;}',
    },
    loadProto,
  );
  assert.match(content, /\n {4}optional int64 id = 1/);
  for (const token of [
    "-9223372036854775808",
    "// keep this comment",
    "/* keep { } */",
    '"https://host/{x};"',
    "reserved 5 to 9;",
  ])
    assert.ok(content.includes(token));
});

test("Protobuf Editions and tab indentation are supported", async () => {
  const { content } = await executeFormatTask(
    {
      action: "format-code",
      language: "proto",
      indent: 4,
      insertSpaces: false,
      content: 'edition="2023";message User{string name=1;}',
    },
    loadProto,
  );
  assert.ok(content.includes('edition = "2023";'));
  assert.match(content, /\n\tstring name = 1;/);
});
