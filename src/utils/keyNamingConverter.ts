import { DiagnosticError, message } from "@/i18n/diagnostics";
import { isLosslessNumber } from "lossless-json";

import { parseJson, stringifyJson } from "@/utils/json";

export type NamingFormat = "camel" | "pascal" | "snake" | "kebab" | "constant";

export interface KeyNamingCollision {
  path: string;
  targetKey: string;
  sourceKeys: string[];
}

export class KeyNamingCollisionError extends DiagnosticError {
  readonly collisions: KeyNamingCollision[];

  constructor(collisions: KeyNamingCollision[]) {
    super(message("检测到 {0} 处字段命名冲突", { 0: collisions.length }));
    this.name = "KeyNamingCollisionError";
    this.collisions = collisions;
  }
}

const SPECIAL_KEY_PREFIX = /^[$@#]/u;
const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

/**
 * 将任意常见命名风格拆分为单词，同时保留 Unicode 字母和相邻数字。
 */
function splitWords(key: string): string[] {
  if (!key) return [];

  const withBoundaries = key
    // URLValue -> URL Value
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    // userName / 用户Name / version2Value -> user Name / 用户 Name / version2 Value
    .replace(/([\p{Ll}\p{Lo}\p{Lm}\p{Lt}\p{N}])(\p{Lu})/gu, "$1 $2");

  return withBoundaries.split(WORD_SEPARATOR).filter(Boolean);
}

function capitalizeWord(word: string): string {
  const [first = "", ...rest] = Array.from(word);

  return first.toUpperCase() + rest.join("").toLowerCase();
}

function toCamelCase(words: string[]): string {
  return words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : capitalizeWord(word),
    )
    .join("");
}

function toPascalCase(words: string[]): string {
  return words.map(capitalizeWord).join("");
}

function toSnakeCase(words: string[]): string {
  return words.map((word) => word.toLowerCase()).join("_");
}

function toKebabCase(words: string[]): string {
  return words.map((word) => word.toLowerCase()).join("-");
}

function toConstantCase(words: string[]): string {
  return words.map((word) => word.toUpperCase()).join("_");
}

export function convertKey(key: string, format: NamingFormat): string {
  if (!key || SPECIAL_KEY_PREFIX.test(key)) return key;

  const words = splitWords(key);

  if (words.length === 0) return key;

  switch (format) {
    case "camel":
      return toCamelCase(words);
    case "pascal":
      return toPascalCase(words);
    case "snake":
      return toSnakeCase(words);
    case "kebab":
      return toKebabCase(words);
    case "constant":
      return toConstantCase(words);
  }
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function appendJsonPointer(path: string, segment: string | number): string {
  return `${path}/${escapeJsonPointerSegment(String(segment))}`;
}

function convertValue(
  value: unknown,
  format: NamingFormat,
  path: string,
  collisions: KeyNamingCollision[],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      convertValue(item, format, appendJsonPointer(path, index), collisions),
    );
  }

  if (value === null || typeof value !== "object" || isLosslessNumber(value)) {
    return value;
  }

  const convertedEntries = Object.entries(value).map(([sourceKey, item]) => ({
    sourceKey,
    targetKey: convertKey(sourceKey, format),
    value: convertValue(
      item,
      format,
      appendJsonPointer(path, sourceKey),
      collisions,
    ),
  }));
  const sourceKeysByTarget = new Map<string, string[]>();

  for (const { sourceKey, targetKey } of convertedEntries) {
    const sourceKeys = sourceKeysByTarget.get(targetKey);

    if (sourceKeys) {
      sourceKeys.push(sourceKey);
    } else {
      sourceKeysByTarget.set(targetKey, [sourceKey]);
    }
  }

  for (const [targetKey, sourceKeys] of sourceKeysByTarget) {
    if (sourceKeys.length > 1) {
      collisions.push({
        path: path || "/",
        targetKey,
        sourceKeys,
      });
    }
  }

  const result: Record<string, unknown> = Object.create(null);

  for (const { targetKey, value: convertedValue } of convertedEntries) {
    if (!Object.prototype.hasOwnProperty.call(result, targetKey)) {
      result[targetKey] = convertedValue;
    }
  }

  return result;
}

/**
 * 递归转换 JSON 值中的所有对象键。任何层级发生命名冲突时整次转换失败。
 */
export function convertKeysDeep<T>(value: T, format: NamingFormat): T {
  const collisions: KeyNamingCollision[] = [];
  const converted = convertValue(value, format, "", collisions) as T;

  if (collisions.length > 0) {
    throw new KeyNamingCollisionError(collisions);
  }

  return converted;
}

/**
 * 解析 JSON 文本、转换全部对象键，并保留 lossless-json 的数值精度。
 */
export function convertJsonKeys(
  jsonString: string,
  format: NamingFormat,
  space = 2,
): string {
  const parsed = parseJson(jsonString);
  const converted = convertKeysDeep(parsed, format);

  return stringifyJson(converted, space);
}

export { splitWords, toCamelCase, toPascalCase, toSnakeCase };
