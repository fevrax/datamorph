import { parseDataFormat } from "@/utils/dataFormatConverter";
import { jsonrepair } from "jsonrepair";
import { queryJsonPath } from "@/utils/jsonPath";
import {
  parseJson,
  stringifyJson,
  sortJson,
  removeJsonComments,
  escapeJson,
  jsonParseError,
  json5ParseError,
} from "@/utils/json";
export type JsonTask =
  | "parse"
  | "validate"
  | "format"
  | "compress"
  | "sort"
  | "repair"
  | "query"
  | "escape"
  | "unescape"
  | "comments";
export interface JsonTaskInput {
  action: JsonTask;
  content: string;
  language?: string;
  indent?: number;
  direction?: "asc" | "desc";
  query?: string;
}
export function executeJsonTask(input: JsonTaskInput): {
  data?: unknown;
  matchCount?: number;
  content?: string;
  error?: { message: string; line: number; column: number; detail?: string };
} {
  const { content, action, indent = 2, language = "json" } = input;
  if (action === "parse") return { data: parseJson(content) };
  if (action === "validate") {
    if (!content.trim() || !["json", "json5"].includes(language)) return {};
    const error =
      language === "json5" ? json5ParseError(content) : jsonParseError(content);
    return error
      ? {
          error: {
            message: error.message,
            detail: error.error?.message,
            line: error.line,
            column: error.column,
          },
        }
      : {};
  }
  if (action === "repair") return { content: jsonrepair(content) };
  if (action === "comments") return { content: removeJsonComments(content) };
  if (action === "escape") return { content: escapeJson(content) };
  if (action === "unescape") {
    try {
      const decoded = JSON.parse('"' + content + '"');
      return { content: typeof decoded === "string" ? decoded : content };
    } catch {
      const decoded = JSON.parse(content);
      if (typeof decoded !== "string") throw new Error("内容不是转义字符串");
      return { content: decoded };
    }
  }
  if (action === "sort")
    return {
      content: stringifyJson(
        parseJson(sortJson(parseJson(content), input.direction || "asc")),
        indent,
      ),
    };
  const value =
    language === "json5"
      ? parseDataFormat(content, "json5")
      : parseJson(content);
  if (action === "query") {
    const matches = queryJsonPath(value, input.query || "");
    return {
      content: stringifyJson(matches, indent),
      matchCount: matches.length,
    };
  }
  return {
    content: stringifyJson(value, action === "compress" ? undefined : indent),
  };
}
