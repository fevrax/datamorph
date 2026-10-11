import assert from "node:assert/strict";
import { test } from "node:test";
import { executeProtoTask } from "./protoTasks";

test("the document worker task renumbers Protobuf fields", () => {
  assert.equal(
    executeProtoTask({
      action: "renumber-proto",
      language: "proto",
      content: "message M { string a = 9; string b = 4; }",
    }).content,
    "message M { string a = 1; string b = 2; }",
  );
});

test("the Protobuf task rejects other document languages", () => {
  assert.throws(
    () =>
      executeProtoTask({
        action: "renumber-proto",
        language: "json",
        content: "{}",
      }),
    /仅支持 Protobuf/,
  );
});
