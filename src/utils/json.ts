// 用于匹配需要转义的字符的正则表达式

// eslint-disable-next-line no-control-regex,no-misleading-character-class
import JSON5 from "json5";
import {
  parse as losslessParse,
  stringify as losslessStringify,
  isLosslessNumber,
} from "lossless-json";

const rxEscapable =
  /[\\"\u0000-\u001F\u007F-\u009F\u00AD\u0600-\u0604\u070F\u17B4\u17B5\u200C-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\uFFF0-\uFFFF]/g;

// 转义字符映射表
const meta: { [key: string]: string } = {
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  '"': '\\"',
  "\\": "\\\\",
};

/**
 * 使用 lossless-json 解析 JSON 字符串，保留长整数精度
 * @param jsonString JSON 字符串
 * @returns 解析后的对象（BigInt 类型）
 */
export function parseJson(jsonString: string): any {
  return losslessParse(jsonString);
}

/**
 * 递归将对象树中的 LosslessNumber 实例转换为原生 number
 * Vanilla JSON Editor 内部使用原生 JSON，无法正确处理 LosslessNumber
 */
export function convertLosslessToNative(value: unknown): unknown {
  if (isLosslessNumber(value)) {
    return value.valueOf();
  }
  if (Array.isArray(value)) {
    return value.map(convertLosslessToNative);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = convertLosslessToNative(v);
    }
    return result;
  }
  return value;
}

/**
 * 使用 lossless-json 序列化对象为 JSON 字符串
 * @param value 要序列化的对象
 * @param space 缩进空格数或缩进字符串
 * @returns JSON 字符串
 */
export function stringifyJson(value: any, space?: number | string): string {
  // 先将 BigInt 转换为 lossless number
  const result = losslessStringify(value, null, space);

  if (result === undefined) {
    throw new Error("序列化失败");
  }

  return result;
}

export function escapeJson(input: string): string {
  // 如果字符串不包含控制字符、引号字符和反斜杠字符，
  // 那么我们可以安全地在其周围加上引号。
  // 否则，我们还必须用安全的转义序列替换有问题的字符。
  try {
    const parsedJson = parseJson(input);
    const jsonString = stringifyJson(parsedJson);

    rxEscapable.lastIndex = 0;

    return rxEscapable.test(jsonString)
      ? jsonString.replace(rxEscapable, (a: string) => {
          return meta[a];
        })
      : jsonString;
  } catch (error) {
    throw error;
  }
}

export interface JsonErrorInfo {
  error?: Error;
  detail?: string;
  contextStartLine?: number;
  message: string;
  line: number;
  column: number;
  context: string;
  errorToken?: string;
  errorContext?: string;
  position?: number;
}

// 解析JSON字符串并返回错误信息
export function jsonParseError(jsonString: string): JsonErrorInfo | undefined {
  try {
    // 使用原生的 JSON.parse 进行解析，以便捕获错误信息
    JSON.parse(jsonString);

    return undefined;
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      return {
        message: `未知错误类型: ${error}`,
        line: 0,
        column: 0,
        context: "",
      };
    }
    const errorPatterns = [
      {
        regex: /at position (\d+) \(line (\d+) column (\d+)\)/,
        handler: (match: RegExpMatchArray) => ({
          position: Number.parseInt(match[1]),
          line: Number.parseInt(match[2]),
          column: Number.parseInt(match[3]),
          message: `JSON解析错误`,
        }),
      },
      {
        regex:
          // @ts-ignore
          /Unexpected token '?(.+?)'?,\s*["'](.+?)["'].*?is not valid JSON/s,
        handler: (match: RegExpMatchArray) => ({
          errorToken: match[1].trim(),
          errorContext: match[2].trim(),
          message: `JSON解析错误：意外的字符`,
        }),
      },
      {
        // Unexpected token 'a', ...""sdaasd": asdasd }" is not valid JSON
        regex:
          /Unexpected token '(.+)',[\s\S]*?"([^"]+)"[\s\S]*?is not valid JSON/,
        handler: (match: RegExpMatchArray) => ({
          errorToken: match[1],
          errorContext: match[2],
          message: `JSON解析错误：意外的字符`,
        }),
      },
      {
        regex: /.*JSON at position (\d+)/,
        handler: (match: RegExpMatchArray) => ({
          position: Number.parseInt(match[1]),
          message: `JSON解析错误：字符串中存在非法控制字符，`,
        }),
      },
    ];

    for (const pattern of errorPatterns) {
      if (!error) {
        continue;
      }
      const match = error.message.match(pattern.regex);

      if (match) {
        const result = pattern.handler(match);

        return getErrorInfo(error, jsonString, result);
      }
    }

    return {
      error,
      message: `未知JSON解析错误，无法定位到错误行。`,
      line: 0,
      column: 0,
      context: "",
    };
  }
}

// 解析JSON5字符串并返回错误信息
export function json5ParseError(jsonString: string): JsonErrorInfo | undefined {
  try {
    JSON5.parse(jsonString);

    return undefined;
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      return {
        message: `未知错误类型: ${error}`,
        line: 0,
        column: 0,
        context: "",
      };
    }

    // 尝试提取 JSON5 错误信息
    const errorMessage = error.message;
    const lineMatch = errorMessage.match(/at line (\d+)/i);
    const columnMatch = errorMessage.match(/at column (\d+)/i);

    if (lineMatch && columnMatch) {
      const line = parseInt(lineMatch[1], 10);
      const column = parseInt(columnMatch[1], 10);
      const context = jsonString.split("\n")[line - 1] || "";

      return {
        error,
        line,
        column,
        message: errorMessage,
        context,
      };
    }

    // 如果无法提取行列信息，返回默认错误
    return {
      error,
      line: 1,
      column: 1,
      message: errorMessage,
      context: jsonString.split("\n")[0] || "",
    };
  }
}

function getErrorInfo(
  error: Error,
  jsonString: string,
  result: Partial<JsonErrorInfo>,
): JsonErrorInfo {
  const lines = jsonString.split("\n");
  let line = result.line;
  let column = result.column;

  if (result.position !== undefined && !line) {
    let currentPosition = 0;

    for (let i = 0; i < lines.length; i++) {
      if (currentPosition + lines[i].length >= result.position) {
        line = i + 1;
        column = result.position - currentPosition + 1;
        break;
      }
      currentPosition += lines[i].length + 1; // +1 for newline character
    }
  }

  if (result.errorContext && !line) {
    const errorLine = lines.findIndex((l) =>
      l.includes(result.errorContext as string),
    );

    if (errorLine !== -1) {
      line = errorLine + 1;
      column = lines[errorLine].indexOf(result.errorContext) + 1;
    }
  }

  const startLine = Math.max(0, (line || 1) - 5);
  const endLine = Math.min(lines.length, (line || 1) + 4);
  const context = lines.slice(startLine, endLine).join("\n");

  result.message = `${result.message}`;

  return {
    error,
    message: result.message || "未知错误",
    line: line || 0,
    column: column || 0,
    context,
    errorToken: result.errorToken,
    position: result.position,
  };
}

export function isArrayOrObject(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

// 递归地按键名排序对象
export function sortJson(data: any, order: "asc" | "desc" = "asc"): string {
  function sortValue(value: any): any {
    if (Array.isArray(value)) {
      // 字段排序不改变数组顺序，只递归处理数组中的对象键。
      return value.map(sortValue);
    } else if (typeof value === "object" && value !== null) {
      if (isLosslessNumber(value)) {
        // 不需要处理
        return value;
      }

      return sortObject(value);
    }

    return value;
  }

  function sortObject(obj: Record<string, any>): Record<string, any> {
    const sortedKeys = Object.keys(obj).sort((a, b) => {
      return order === "asc" ? a.localeCompare(b) : b.localeCompare(a);
    });

    // 使用无原型对象，让 __proto__ 也作为普通自有字段保留。
    const sortedObj: Record<string, any> = Object.create(null);

    sortedKeys.forEach((key) => {
      sortedObj[key] = sortValue(obj[key]);
    });

    return sortedObj;
  }

  const sortedResult = sortValue(data);

  return stringifyJson(sortedResult, 4);
}

/**
 * 删除 JSON 文本中的注释
 * @param jsonText 包含注释的 JSON 文本
 * @returns 注释替换为空格后的 JSON 文本，保留原始换行和位置
 */
export function removeJsonComments(jsonText: string): string {
  const result: string[] = [];
  let quote: string | null = null;
  let escaped = false;
  let comment: "line" | "block" | null = null;

  for (let i = 0; i < jsonText.length; i++) {
    const char = jsonText[i];
    const next = jsonText[i + 1];
    const isNewline =
      char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029";

    if (comment !== null) {
      if (comment === "block" && char === "*" && next === "/") {
        result.push("  ");
        i++;
        comment = null;
      } else {
        // 保留行列位置，并避免注释两侧的 token 被拼接。
        result.push(isNewline ? char : " ");
        if (comment === "line" && isNewline) comment = null;
      }
    } else if (quote !== null) {
      result.push(char);
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      result.push(char);
    } else if (char === "/" && (next === "/" || next === "*")) {
      comment = next === "/" ? "line" : "block";
      result.push("  ");
      i++;
    } else {
      result.push(char);
    }
  }

  return result.join("");
}
