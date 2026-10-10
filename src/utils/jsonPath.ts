import { exec, type JsonValue } from "jsonpath-rfc9535";
import parsePath from "jsonpath-rfc9535/parser";
import { isLosslessNumber, isSafeNumber } from "lossless-json";
import JSON5 from "json5";

/** Evaluate a native JSON tree, then read matches from the lossless source. */
export function queryJsonPath(source: unknown, expression: string): unknown[] {
  const path = expression.trim();
  if (!path.startsWith("$")) {
    throw new Error("JSONPath 必须以 $ 开头，例如 $.users[*].name");
  }
  // Validate first: malformed paths must not look like successful empty queries.
  const ast = parsePath(path);
  let hasFilter = false;
  const inspect = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if ("type" in node && node.type === "FilterSelector") hasFilter = true;
    Object.values(node).forEach(inspect);
  };
  inspect(ast);
  if (hasFilter) {
    // Ignore quoted property names/strings when checking numeric literals.
    const unquoted = path.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
    for (const token of unquoted.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ||
      []) {
      if (!isSafeNumber(token)) {
        throw new Error(
          "过滤条件中的数字超出安全精度，请将长 ID 存为字符串后比较。",
        );
      }
    }
  }
  const native = (value: unknown): JsonValue => {
    if (isLosslessNumber(value)) {
      if (hasFilter && !isSafeNumber(value.value)) {
        throw new Error(
          "数据含超出安全精度的数字，暂不支持条件过滤；可用字段路径直接提取，或将长 ID 存为字符串。",
        );
      }
      return Number(value.value);
    }
    if (Array.isArray(value)) return value.map(native);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, native(child)]),
      );
    }
    return value as JsonValue;
  };
  const result: unknown[] = [];
  exec(native(source), path, (_value, segments) => {
    let original = source;
    // The engine escapes string segments using RFC normalized-path rules.
    for (const segment of segments) {
      const key =
        typeof segment === "number" ? segment : JSON5.parse(`'${segment}'`);
      original = (original as Record<string | number, unknown>)[key];
    }
    result.push(original);
  });
  return result;
}
