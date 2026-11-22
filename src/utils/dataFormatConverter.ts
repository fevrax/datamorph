import { messageError } from "@/i18n/diagnostics";
import YAML from "js-yaml";
import JSON5 from "json5";
import TOML from "@iarna/toml";
import { xml2js, js2xml } from "xml-js";
import {
  compareNumber,
  LosslessNumber,
  isLosslessNumber,
  isSafeNumber,
  parse,
  stringify,
} from "lossless-json";

// Keep decimal tokens until the destination's numeric capabilities are known.
// JSON5 output deliberately uses its JSON subset, which supports exact tokens.
function decimalToken(raw: string): string {
  let value = raw.replace(/_/g, "").replace(/^\+/, "");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;

  if (/^0[xob]/i.test(unsigned)) {
    return (negative ? -BigInt(unsigned) : BigInt(unsigned)).toString();
  }
  value = value.replace(/^(-?)\./, "$10.").replace(/\.(?=[eE]|$)/, ".0");
  value = value.replace(/^(-?)0+(?=\d)/, "$1");

  return value;
}

const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const integerPattern = /^[+-]?(?:\d+|0x[\da-f]+|0o[0-7]+|0b[01]+)$/i;

// Accept digit separators without turning quoted numeric strings into numbers.
function yamlNumericToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.includes("_") && /(^_|_$|[^0-9a-f]_|_[^0-9a-f])/i.test(value))
    return undefined;

  return value.replace(/_/g, "");
}

const yamlInteger = new YAML.Type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: (value) =>
    yamlNumericToken(value) !== undefined &&
    integerPattern.test(yamlNumericToken(value)!),
  construct: (value) => new LosslessNumber(decimalToken(value)),
  predicate: (value) => isLosslessNumber(value) && /^-?\d+$/.test(value.value),
  represent: (value) => (value as LosslessNumber).value,
});
const yamlFloat = new YAML.Type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: (value) =>
    typeof value === "string" &&
    (decimalPattern.test(yamlNumericToken(value) ?? "") ||
      /^[+-]?\.(?:inf|nan)$/i.test(value)),
  construct: (value) => {
    if (!decimalPattern.test(yamlNumericToken(value) ?? ""))
      throw messageError("无法无损转换非有限数值（NaN/Infinity）");

    return new LosslessNumber(decimalToken(value));
  },
  predicate: isLosslessNumber,
  represent: (value) => (value as LosslessNumber).value,
});
const yamlSchema = YAML.DEFAULT_SCHEMA.extend({
  implicit: [yamlInteger, yamlFloat],
});

// Lex only after the format library validates syntax. Strings and comments must
// be consumed whole: replacing digits with a global regex corrupts user text.
function tokens(text: string, toml = false): string[] {
  const result: string[] = [];
  let i = 0;
  const punctuation = toml ? /[{}\[\],=]/ : /[{}\[\],:=]/;
  const boundary = toml ? /[\s{}\[\],=]/ : /[\s{}\[\],:=]/;

  while (i < text.length) {
    const start = i;
    const char = text[i];

    if (/\s/.test(char)) {
      if (toml && /[\r\n]/.test(char)) result.push("\n");
      i++;
      continue;
    }
    if ((toml && char === "#") || (!toml && text.startsWith("//", i))) {
      while (i < text.length && !/[\r\n\u2028\u2029]/.test(text[i])) i++;
      continue;
    }
    if (!toml && text.startsWith("/*", i)) {
      i = text.indexOf("*/", i + 2) + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      const delimiter =
        toml && text.startsWith(char.repeat(3), i) ? char.repeat(3) : char;

      i += delimiter.length;
      while (i < text.length) {
        if (text[i] === "\\" && (!toml || char === '"')) {
          i += 2;
          continue;
        }
        if (text.startsWith(delimiter, i)) {
          i += delimiter.length;
          // TOML multiline strings can end with four or five quotes.
          if (delimiter.length === 3) while (text[i] === char) i++;
          break;
        }
        i++;
      }
    } else if (punctuation.test(char)) {
      i++;
    } else {
      while (
        i < text.length &&
        !boundary.test(text[i]) &&
        !(toml ? text[i] === "#" : text[i] === "/")
      )
        i++;
    }
    if (i === start) throw messageError("无法识别的格式标记");
    result.push(text.slice(start, i));
  }

  return result;
}

function parseJson5(text: string): unknown {
  JSON5.parse(text); // Syntax validation only; never use its rounded numbers.
  const parts = tokens(text);
  const normalized = parts
    .map((part, index) => {
      if (part === "," && /^[}\]]$/.test(parts[index + 1])) return "";
      if (parts[index + 1] === ":") {
        return JSON.stringify(Object.keys(JSON5.parse(`{${part}:null}`))[0]);
      }
      if (/^["']/.test(part)) return JSON.stringify(JSON5.parse(part));
      if (/^[+-]?(?:Infinity|NaN)$/.test(part)) {
        throw messageError("无法无损转换非有限数值（NaN/Infinity）");
      }
      if (decimalPattern.test(part) || integerPattern.test(part))
        return decimalToken(part);

      return part;
    })
    .join(" ");

  return parse(normalized);
}

const minInteger = -(BigInt(2) ** BigInt(63));
const maxInteger = BigInt(2) ** BigInt(63) - BigInt(1);

function tomlInteger(raw: string): bigint {
  const value = BigInt(raw);

  if (value < minInteger || value > maxInteger) {
    throw messageError("TOML 无法无损表示超出 64 位整数范围的数值: {0}", {
      0: raw,
    });
  }

  return value;
}

function safeNumber(raw: string): number {
  if (!isSafeNumber(raw))
    throw messageError("无法无损转换数值（精度损失或溢出）: {0}", { 0: raw });

  return Number(raw);
}

function parseToml(text: string): unknown {
  const data = TOML.parse(text);
  const parts = tokens(text, true);
  let inValue = false;
  let depth = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part === "\n" && depth === 0) inValue = false;
    if (!inValue) {
      if (part === "=") inValue = true;
      continue; // Table headers and keys are never numeric values.
    }
    if (part === "[" || part === "{") depth++;
    if (part === "]" || part === "}") depth--;
    const raw = part.replace(/_/g, "");

    if (parts[i + 1] === "=") continue; // Numeric bare keys are strings.
    if (integerPattern.test(raw)) {
      const decimal = decimalToken(raw);

      tomlInteger(decimal); // The dependency wraps overflowing BigInts to 64 bits.
      if (Object.is(Number(decimal), -0))
        throw messageError("TOML 整数 -0 无法保留负零；请使用 -0.0");
    } else if (decimalPattern.test(raw)) {
      safeNumber(decimalToken(raw));
    }
  }

  return data;
}

// Reject types that serializers would silently coerce or omit. Also reject
// cycles from YAML aliases; repeated (noncyclic) references remain supported.
function mapTree(
  value: unknown,
  scalar: (value: unknown, path: string) => unknown,
  path = "$",
  ancestors = new Set<object>(),
): unknown {
  if (value === null || typeof value !== "object" || isLosslessNumber(value))
    return scalar(value, path);
  if (
    value instanceof Date ||
    (!Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw messageError("无法无损转换特殊类型: {0}", { 0: path });
  }
  if (ancestors.has(value))
    throw messageError("无法转换循环引用: {0}", { 0: path });
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map((item, i) => mapTree(item, scalar, `${path}[${i}]`, ancestors))
    : Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          mapTree(item, scalar, `${path}.${key}`, ancestors),
        ]),
      );

  ancestors.delete(value);

  return result;
}

function validateScalar(value: unknown, path: string): unknown {
  if (
    value === undefined ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    throw messageError("无法无损转换非有限数值或空文档: {0}", { 0: path });
  }
  if (typeof value === "number")
    return new LosslessNumber(Object.is(value, -0) ? "-0" : String(value));
  if (typeof value === "bigint") return new LosslessNumber(String(value));

  return value;
}

export function parseDataFormat(text: string, format: string): unknown {
  let value: unknown;

  switch (format) {
    case "json":
      value = parse(text);
      break;
    case "json5":
      value = parseJson5(text);
      break;
    case "yaml":
      value = YAML.load(text, { schema: yamlSchema });
      break;
    case "toml":
      value = parseToml(text);
      break;
    // XML intentionally retains xml-js compact representation and string text.
    case "xml":
      value = xml2js(text, { compact: true });
      break;
    default:
      throw messageError("不支持的输入格式: {0}", { 0: format });
  }

  return mapTree(value, validateScalar);
}

// TOML's serializer promotes mixed integer/float arrays to floats. Verify the
// emitted document as well as individual inputs, so promotion cannot round data.
function assertEquivalent(expected: unknown, actual: unknown): void {
  if (isLosslessNumber(expected) && isLosslessNumber(actual)) {
    if (
      compareNumber(expected.value, actual.value) === 0 &&
      Object.is(Number(expected.value), -0) ===
        Object.is(Number(actual.value), -0)
    )
      return;
  } else if (
    expected !== null &&
    actual !== null &&
    typeof expected === "object" &&
    typeof actual === "object"
  ) {
    const left = Object.entries(expected);
    const right = Object.entries(actual);

    if (
      Array.isArray(expected) === Array.isArray(actual) &&
      left.length === right.length
    ) {
      for (const [key, item] of left) {
        if (!Object.prototype.hasOwnProperty.call(actual, key))
          throw messageError("TOML 无法无损保留对象结构");
        assertEquivalent(item, (actual as Record<string, unknown>)[key]);
      }

      return;
    }
  } else if (expected === actual) return;
  throw messageError("TOML 无法无损保留数值或类型");
}

// Inspect compact XML keys directly: dots in element/attribute/PI names are
// literal name characters, not path separators. Arrays retain their key context.
function xmlCompactValue(value: unknown, keys: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => xmlCompactValue(item, keys));
  }
  if (value !== null && typeof value === "object" && !isLosslessNumber(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        xmlCompactValue(item, [...keys, key]),
      ]),
    );
  }
  const key = keys[keys.length - 1];
  const parent = keys[keys.length - 2];
  const numeric =
    key === "_text" || key === "_cdata" || parent === "_attributes";
  const scalar =
    numeric ||
    parent === "_instruction" ||
    ["_comment", "_doctype", "_instruction"].includes(key);

  if (isLosslessNumber(value)) {
    if (!numeric)
      throw messageError("XML 数值请放入 _text 或 _attributes: {0}", {
        0: JSON.stringify(keys),
      });

    return value.value;
  }
  if (!scalar)
    throw messageError(
      "XML 不支持普通对象标量，请使用 _text 或 _attributes: {0}",
      { 0: JSON.stringify(keys) },
    );

  return value;
}

export function serializeDataFormat(value: unknown, format: string): string {
  const data = mapTree(value, validateScalar);

  switch (format) {
    case "json":
    case "json5":
      return stringify(data, null, 2)!;
    case "yaml":
      return YAML.dump(data, { schema: yamlSchema });
    case "toml": {
      const native = mapTree(data, (item, path) => {
        if (item === null)
          throw messageError("TOML 不支持 null，无法无损转换: {0}", {
            0: path,
          });
        if (!isLosslessNumber(item)) return item;
        if (/^-?\d+$/.test(item.value) && !Object.is(Number(item.value), -0))
          return tomlInteger(item.value);
        const number = safeNumber(item.value);

        if (Number.isInteger(number) && !Object.is(number, -0))
          tomlInteger(BigInt(number).toString());

        return number;
      });

      const output = TOML.stringify(
        native as Parameters<typeof TOML.stringify>[0],
      );

      assertEquivalent(data, parseDataFormat(output, "toml"));

      return output;
    }
    case "xml": {
      const native = xmlCompactValue(data);

      return js2xml(native as Parameters<typeof js2xml>[0], {
        compact: true,
        spaces: 2,
      });
    }
    default:
      throw messageError("不支持的输出格式: {0}", { 0: format });
  }
}

export function convertDataFormat(
  text: string,
  inputFormat: string,
  outputFormat: string,
): string {
  return serializeDataFormat(parseDataFormat(text, inputFormat), outputFormat);
}

export function formatDataFormat(text: string, format: string): string {
  return convertDataFormat(text, format, format);
}
