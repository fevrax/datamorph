import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJson } from "../utils/json";
import { queryJsonPath } from "../utils/jsonPath";
import { createColumnBrowser, formatNodePath } from "./jsonColumns";

test("shows neighboring levels and preserves lossless scalar previews", () => {
  const data = parseJson('{"items":[{}, {"a.b":{"x":9007199254740993123}}]}');
  const path = ["items", 1, "a.b", "x"];
  const result = createColumnBrowser(data)(path, {});
  assert.deepEqual(result.path, path);
  assert.deepEqual(
    result.columns.map(({ depth }) => depth),
    [2, 3],
  );
  assert.equal(result.type, "number");
  assert.equal(result.preview, "9007199254740993123");
  assert.equal(formatNodePath(path), '$.items[1]["a.b"].x');
  assert.equal(
    String(queryJsonPath(data, formatNodePath(path))[0]),
    result.preview,
  );
});

test("copies unambiguous paths for quoted, empty and numeric object keys", () => {
  const data = { 'a"\nb': { "": { "0": "found" } } };
  const path = ['a"\nb', "", "0"];
  assert.deepEqual(queryJsonPath(data, formatNodePath(path)), ["found"]);
  assert.equal(formatNodePath([]), "$");
  assert.equal(formatNodePath(["0"]), '$["0"]');
  assert.equal(formatNodePath([0]), "$[0]");
});

test("paginates siblings and opens the page containing the selected node", () => {
  const browse = createColumnBrowser(
    Array.from({ length: 213 }, (_, index) => index),
  );
  const next = browse([], { 0: 1 });
  assert.equal(next.columns[0].rows.length, 100);
  assert.equal(next.columns[0].rows[0].key, 100);
  const selected = browse([205], {});
  assert.equal(selected.columns[0].page, 2);
  assert.equal(selected.columns[0].rows.length, 13);
  assert.equal(selected.preview, "205");
  assert.ok(next.preview.length < 4001);
});

test("supports empty containers, null, and safely resolves only own JSON keys", () => {
  assert.equal(createColumnBrowser(null)([], {}).preview, "null");
  assert.equal(createColumnBrowser([])([], {}).columns[0].count, 0);
  const browse = createColumnBrowser({
    node: { isLosslessNumber: true, value: "1" },
  });
  assert.equal(browse(["node"], {}).type, "object");
  assert.deepEqual(browse(["node", "constructor"], {}).path, ["node"]);
  assert.deepEqual(createColumnBrowser([1])(["0"], {}).path, []);
  assert.equal(
    createColumnBrowser("x".repeat(100_000))([], {}).preview.length,
    4001,
  );
});

test("browses an own __proto__ field without mistaking it for a prototype", () => {
  const data = parseJson('{"__proto__":{"nested":9007199254740993123}}');
  const browse = createColumnBrowser(data);
  assert.equal(browse([], {}).columns[0].rows[0].key, "__proto__");
  assert.equal(
    browse(["__proto__", "nested"], {}).preview,
    "9007199254740993123",
  );
  assert.deepEqual(browse(["nested"], {}).path, []);
});
