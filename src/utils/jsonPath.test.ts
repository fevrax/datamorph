import { test } from "node:test";
import assert from "node:assert/strict";
import { executeJsonTask } from "../workers/jsonTasks";
import { jsonPathExamples, jsonPathSample } from "./jsonPathExamples";

function query(content: string, path: string, language = "json") {
  return executeJsonTask({ action: "query", content, query: path, language });
}
function values(path: string) {
  return JSON.parse(query(JSON.stringify(jsonPathSample), path).content!);
}
test("JSONPath examples produce the documented matches", () => {
  const expected = [
    ["张三", "李四", "王五", "赵六"],
    [jsonPathSample.users[0]],
    jsonPathSample.users.slice(1),
    ["张三", "王五"],
    jsonPathSample.users.slice(0, 2),
    ["张三", "李四", "王五", "赵六"],
    ["张三", "王五"],
    ["2026-10-09"],
  ];
  jsonPathExamples.forEach((example, i) =>
    assert.deepEqual(values(example.path), expected[i], example.path),
  );
});
test("JSONPath results consistently wrap root, primitive, null and empty matches", () => {
  for (const [content, path, expected] of [
    ['{"a":[1,2]}', "$.a", [[1, 2]]],
    ["null", "$", [null]],
    ["false", "$", [false]],
    ["0", "$", [0]],
    ['"hello"', "$", ["hello"]],
    ["{}", "$.missing", []],
  ] as const) {
    const result = query(content, path);
    assert.deepEqual(JSON.parse(result.content!), expected);
    assert.equal(result.matchCount, expected.length);
  }
});
test("JSONPath supports slices, unions, existence, root references and standard functions", () => {
  assert.deepEqual(values("$.users[-1].name"), ["赵六"]);
  assert.deepEqual(values("$.users[0,2].name"), ["张三", "王五"]);
  assert.deepEqual(values("$.users[?@.active].id"), [1, 2, 3, 4]);
  assert.deepEqual(values("$.users[?@.id == $.metadata.total].name"), ["赵六"]);
  assert.deepEqual(values("$.users[?length(@.name) == 2].name"), [
    "张三",
    "李四",
    "王五",
    "赵六",
  ]);
});
test("JSONPath treats lossless numbers as leaves and preserves their exact output", () => {
  const content =
    '{"id":900719925474099312345,"nested":{"n":1.234567890123456789},"other":2}';
  assert.match(query(content, "$.id").content!, /900719925474099312345/);
  assert.match(query(content, "$..n").content!, /1\.234567890123456789/);
  assert.equal(query(content, "$..*").matchCount, 4);
  assert.equal(query(content, "$..isLosslessNumber").matchCount, 0);
  assert.equal(query(content, "$.id.value").matchCount, 0);
  assert.match(
    query("{id:900719925474099312345,}", "$.id", "json5").content!,
    /900719925474099312345/,
  );
});
test("JSONPath returns original values for escaped, unicode and prototype-looking keys", () => {
  for (const key of [
    "中文",
    "a'b",
    'a"b',
    "a\\b",
    "a\nb",
    "a.b",
    "constructor",
  ]) {
    const content = JSON.stringify({ [key]: 123 });
    assert.deepEqual(JSON.parse(query(content, "$.*").content!), [123], key);
    assert.deepEqual(
      JSON.parse(query(content, `$[${JSON.stringify(key)}]`).content!),
      [123],
      key,
    );
  }
});
test("malformed, legacy and executable expressions fail explicitly", () => {
  for (const path of [
    "",
    ".users",
    ".users | map(.name)",
    "$.users[",
    "$.users[?(@.age >=)]",
    "$.users[?globalThis.process.exit()]",
    "$.users[?(@.age = 1)]",
  ]) {
    assert.throws(() => values(path), Error, path);
  }
  assert.throws(() => query("{bad json", "$"));
});
test("filters reject unsafe numeric inputs instead of silently rounding comparisons", () => {
  assert.throws(
    () => query('[{"id":9007199254740993}]', "$[?@.id > 0]"),
    /安全精度/,
  );
  assert.throws(
    () => query('[{"id":1}]', "$[?@.id == 9007199254740993]"),
    /安全精度/,
  );
  assert.deepEqual(
    JSON.parse(
      query('[{"id":"9007199254740993"}]', '$[?@.id == "9007199254740993"]')
        .content!,
    ),
    [{ id: "9007199254740993" }],
  );
});

test("tree query builder uses the same engine and preserves filter literals", async () => {
  const { jsonPathLanguage } = await import("./jsonPathLanguage");
  const path = jsonPathLanguage.createQuery(null, {
    filter: { path: ["age"], relation: ">=", value: "28" },
    projection: { paths: [["name"]] },
  });
  assert.deepEqual(
    JSON.parse(query(JSON.stringify(jsonPathSample.users), path).content!),
    ["李四", "王五", "赵六"],
  );
  assert.throws(
    () =>
      jsonPathLanguage.createQuery(null, {
        sort: { path: ["age"], direction: "asc" },
      }),
    /不支持排序/,
  );
  const precise = jsonPathLanguage.createQuery(null, {
    filter: { path: ["id"], relation: "==", value: "9007199254740993" },
  });
  assert.ok(precise.includes("9007199254740993"));
  assert.throws(() => query('[{"id":1}]', precise), /安全精度/);
});
