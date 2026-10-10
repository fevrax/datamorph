import type { QueryLanguage } from "vanilla-jsoneditor-cn";
import { parseJson, stringifyJson } from "./json";
import { queryJsonPath } from "./jsonPath";

/** Use the same RFC engine in the tree editor's transform dialog. */
export const jsonPathLanguage: QueryLanguage = {
  id: "jsonpath",
  name: "JSONPath",
  description:
    "<p>输入 JSONPath 表达式（如 <code>$.users[*].name</code>）选择节点。结果始终为数组，支持 RFC 9535 语法，不支持排序或对象重构。</p>",
  createQuery: (_json, { filter, sort, projection }) => {
    if (sort?.path && sort.direction) {
      throw new Error("JSONPath 不支持排序，请清空排序选项。");
    }
    const segments = (path: (string | number)[]) =>
      path.map((key) => `[${JSON.stringify(key)}]`).join("");
    let query = "$";
    if (filter?.path && filter.relation && filter.value) {
      let value: string;
      try {
        value = stringifyJson(parseJson(filter.value));
      } catch {
        value = JSON.stringify(filter.value);
      }
      query += `[?(@${segments(filter.path)} ${filter.relation} ${value})]`;
    }
    if (projection?.paths?.length) {
      if (projection.paths.length > 1)
        throw new Error("JSONPath 不支持对象重构，请只选择一个提取字段。");
      if (query === "$") query += "[*]";
      query += segments(projection.paths[0]);
    }
    return query;
  },
  executeQuery: queryJsonPath,
};
