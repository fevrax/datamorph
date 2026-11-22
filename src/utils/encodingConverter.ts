import { DiagnosticError, message, type Diagnostic } from "@/i18n/diagnostics";
import { Base64 } from "js-base64";

export type EncodingType =
  | "text"
  | "base64"
  | "base64url"
  | "url"
  | "unicode"
  | "hex"
  | "binary";

export type UrlEncodingMode = "component" | "full" | "form";
export type ByteSeparator = "space" | "none";

export interface EncodingOptions {
  base64Padding: boolean;
  urlMode: UrlEncodingMode;
  unicodeEscapeAll: boolean;
  hexUppercase: boolean;
  hexSeparator: ByteSeparator;
  hexPrefix: boolean;
  binarySeparator: ByteSeparator;
  binaryPrefix: boolean;
}

export interface EncodingDetection {
  type: Exclude<EncodingType, "text">;
  confidence: "high";
}

export class EncodingConversionError extends DiagnosticError {
  readonly encoding: EncodingType;

  constructor(encoding: EncodingType, diagnostic: Diagnostic) {
    super(diagnostic);
    this.name = "EncodingConversionError";
    this.encoding = encoding;
  }
}

export const DEFAULT_ENCODING_OPTIONS: EncodingOptions = {
  base64Padding: true,
  urlMode: "component",
  unicodeEscapeAll: false,
  hexUppercase: false,
  hexSeparator: "space",
  hexPrefix: false,
  binarySeparator: "space",
  binaryPrefix: false,
};

const utf8Encoder = new TextEncoder();

function decodeUtf8(bytes: Uint8Array, encoding: EncodingType): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new EncodingConversionError(
      encoding,
      message("解码后的字节不是有效的 UTF-8 文本"),
    );
  }
}

function normalizeBase64(input: string, type: "base64" | "base64url"): string {
  const label = type === "base64" ? "Base64" : "Base64URL";
  const compact = input.replace(/\s+/g, "");
  const pattern =
    type === "base64" ? /^[A-Za-z0-9+/]*={0,2}$/u : /^[A-Za-z0-9_-]*={0,2}$/u;

  if (!compact || !pattern.test(compact)) {
    throw new EncodingConversionError(
      type,
      message("请输入有效的 {0} 内容", { 0: label }),
    );
  }

  const firstPadding = compact.indexOf("=");
  const content = firstPadding >= 0 ? compact.slice(0, firstPadding) : compact;
  const existingPadding = firstPadding >= 0 ? compact.length - firstPadding : 0;

  if (content.length % 4 === 1 || existingPadding > 2) {
    throw new EncodingConversionError(
      type,
      message("{0} 长度或填充不正确", { 0: label }),
    );
  }

  const standard = content.replace(/-/g, "+").replace(/_/g, "/");
  const requiredPadding = (4 - (standard.length % 4)) % 4;

  if (existingPadding > 0 && existingPadding !== requiredPadding) {
    throw new EncodingConversionError(
      type,
      message("{0} 填充不正确", { 0: label }),
    );
  }

  return standard + "=".repeat(requiredPadding);
}

function decodeBase64(input: string, type: "base64" | "base64url"): string {
  const normalized = normalizeBase64(input, type);

  try {
    return decodeUtf8(Base64.toUint8Array(normalized), type);
  } catch (error) {
    if (error instanceof EncodingConversionError) throw error;
    throw new EncodingConversionError(
      type,
      message("请输入有效的 {0} 内容", {
        0: type === "base64" ? "Base64" : "Base64URL",
      }),
    );
  }
}

function encodeBase64(
  input: string,
  type: "base64" | "base64url",
  options: EncodingOptions,
): string {
  const encoded = Base64.fromUint8Array(utf8Encoder.encode(input));
  const result =
    type === "base64url"
      ? encoded.replace(/\+/g, "-").replace(/\//g, "_")
      : encoded;

  return options.base64Padding ? result : result.replace(/=+$/u, "");
}

function decodeUrl(input: string, mode: UrlEncodingMode): string {
  try {
    if (mode === "full") return decodeURI(input);
    if (mode === "form") return decodeURIComponent(input.replace(/\+/g, " "));

    return decodeURIComponent(input);
  } catch {
    throw new EncodingConversionError(
      "url",
      message("URL 百分号转义不完整或格式无效"),
    );
  }
}

function encodeUrl(input: string, mode: UrlEncodingMode): string {
  if (mode === "full") return encodeURI(input);

  const encoded = encodeURIComponent(input);

  if (mode !== "form") return encoded;

  return encoded
    .replace(/%20/g, "+")
    .replace(
      /[!'()~]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function readHex(input: string, index: number, length: number): string | null {
  const value = input.slice(index, index + length);

  return new RegExp(`^[0-9a-fA-F]{${length}}$`, "u").test(value) ? value : null;
}

function decodeUnicode(input: string): string {
  let output = "";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character !== "\\") {
      output += character;
      continue;
    }

    const marker = input[index + 1];

    if (!marker) {
      throw new EncodingConversionError(
        "unicode",
        message("末尾存在不完整的转义符"),
      );
    }

    const commonEscapes: Record<string, string> = {
      "\\": "\\",
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      v: "\v",
      "0": "\0",
      '"': '"',
      "'": "'",
    };

    if (marker in commonEscapes) {
      output += commonEscapes[marker];
      index += 1;
      continue;
    }

    if (marker === "x") {
      const hex = readHex(input, index + 2, 2);

      if (!hex) {
        throw new EncodingConversionError(
          "unicode",
          message("存在无效的 \\x 转义"),
        );
      }

      output += String.fromCodePoint(Number.parseInt(hex, 16));
      index += 3;
      continue;
    }

    if (marker !== "u") {
      throw new EncodingConversionError(
        "unicode",
        message("不支持的转义序列：\\{0}", { 0: marker }),
      );
    }

    if (input[index + 2] === "{") {
      const closingIndex = input.indexOf("}", index + 3);

      if (closingIndex < 0) {
        throw new EncodingConversionError(
          "unicode",
          message("存在未闭合的 \\u{...} 转义"),
        );
      }

      const code = input.slice(index + 3, closingIndex);
      const codePoint = Number.parseInt(code, 16);

      if (
        !/^[0-9a-fA-F]{1,6}$/u.test(code) ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        throw new EncodingConversionError(
          "unicode",
          message("存在无效的 Unicode 码点"),
        );
      }

      output += String.fromCodePoint(codePoint);
      index = closingIndex;
      continue;
    }

    const firstHex = readHex(input, index + 2, 4);

    if (!firstHex) {
      throw new EncodingConversionError(
        "unicode",
        message("存在无效的 \\u 转义"),
      );
    }

    const firstCodeUnit = Number.parseInt(firstHex, 16);

    if (firstCodeUnit >= 0xd800 && firstCodeUnit <= 0xdbff) {
      if (input.slice(index + 6, index + 8) !== "\\u") {
        throw new EncodingConversionError(
          "unicode",
          message("高位代理项缺少低位代理项"),
        );
      }

      const secondHex = readHex(input, index + 8, 4);
      const secondCodeUnit = secondHex ? Number.parseInt(secondHex, 16) : -1;

      if (secondCodeUnit < 0xdc00 || secondCodeUnit > 0xdfff) {
        throw new EncodingConversionError("unicode", message("代理项组合无效"));
      }

      output += String.fromCodePoint(
        0x10000 + ((firstCodeUnit - 0xd800) << 10) + (secondCodeUnit - 0xdc00),
      );
      index += 11;
      continue;
    }

    if (firstCodeUnit >= 0xdc00 && firstCodeUnit <= 0xdfff) {
      throw new EncodingConversionError(
        "unicode",
        message("存在孤立的低位代理项"),
      );
    }

    output += String.fromCodePoint(firstCodeUnit);
    index += 5;
  }

  return output;
}

function unicodeEscape(codePoint: number): string {
  if (codePoint <= 0xffff) {
    return `\\u${codePoint.toString(16).padStart(4, "0")}`;
  }

  const value = codePoint - 0x10000;
  const high = 0xd800 + (value >> 10);
  const low = 0xdc00 + (value & 0x3ff);

  return `\\u${high.toString(16)}\\u${low.toString(16)}`;
}

function encodeUnicode(input: string, escapeAll: boolean): string {
  let output = "";

  for (const character of input) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (character === "\\") output += "\\\\";
    else if (character === "\n") output += "\\n";
    else if (character === "\r") output += "\\r";
    else if (character === "\t") output += "\\t";
    else if (character === "\b") output += "\\b";
    else if (character === "\f") output += "\\f";
    else if (character === "\v") output += "\\v";
    else if (codePoint === 0) output += "\\0";
    else if (escapeAll || codePoint < 0x20 || codePoint > 0x7e) {
      output += unicodeEscape(codePoint);
    } else output += character;
  }

  return output;
}

function decodeByteString(input: string, encoding: "hex" | "binary"): string {
  const withoutPrefixes = input.replace(
    encoding === "hex" ? /0x/gi : /0b/gi,
    "",
  );
  const compact = withoutPrefixes.replace(/[\s,;:_-]+/g, "");
  const pattern = encoding === "hex" ? /^[0-9a-fA-F]+$/u : /^[01]+$/u;
  const byteLength = encoding === "hex" ? 2 : 8;

  if (!compact || !pattern.test(compact)) {
    throw new EncodingConversionError(
      encoding,
      message("请输入有效的{0}内容", {
        0: encoding === "hex" ? message("十六进制") : message("二进制"),
      }),
    );
  }

  if (compact.length % byteLength !== 0) {
    throw new EncodingConversionError(
      encoding,
      message("{0} 必须由完整字节组成", {
        0: encoding === "hex" ? "Hex" : "Binary",
      }),
    );
  }

  const bytes = new Uint8Array(compact.length / byteLength);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      compact.slice(index * byteLength, (index + 1) * byteLength),
      encoding === "hex" ? 16 : 2,
    );
  }

  return decodeUtf8(bytes, encoding);
}

function encodeHex(input: string, options: EncodingOptions): string {
  const values = Array.from(utf8Encoder.encode(input), (byte) => {
    const digits = byte.toString(16).padStart(2, "0");
    const normalized = options.hexUppercase ? digits.toUpperCase() : digits;

    return options.hexPrefix ? `0x${normalized}` : normalized;
  });

  return values.join(options.hexSeparator === "space" ? " " : "");
}

function encodeBinary(input: string, options: EncodingOptions): string {
  const values = Array.from(utf8Encoder.encode(input), (byte) => {
    const digits = byte.toString(2).padStart(8, "0");

    return options.binaryPrefix ? `0b${digits}` : digits;
  });

  return values.join(options.binarySeparator === "space" ? " " : "");
}

export function decodeToText(
  input: string,
  source: EncodingType,
  options: EncodingOptions = DEFAULT_ENCODING_OPTIONS,
): string {
  switch (source) {
    case "text":
      return input;
    case "base64":
    case "base64url":
      return decodeBase64(input, source);
    case "url":
      return decodeUrl(input, options.urlMode);
    case "unicode":
      return decodeUnicode(input);
    case "hex":
    case "binary":
      return decodeByteString(input, source);
  }
}

export function encodeFromText(
  input: string,
  target: EncodingType,
  options: EncodingOptions = DEFAULT_ENCODING_OPTIONS,
): string {
  switch (target) {
    case "text":
      return input;
    case "base64":
    case "base64url":
      return encodeBase64(input, target, options);
    case "url":
      return encodeUrl(input, options.urlMode);
    case "unicode":
      return encodeUnicode(input, options.unicodeEscapeAll);
    case "hex":
      return encodeHex(input, options);
    case "binary":
      return encodeBinary(input, options);
  }
}

export function convertEncoding(
  input: string,
  source: EncodingType,
  target: EncodingType,
  sourceOptions: EncodingOptions = DEFAULT_ENCODING_OPTIONS,
  targetOptions: EncodingOptions = DEFAULT_ENCODING_OPTIONS,
): string {
  if (source === target) return input;

  return encodeFromText(
    decodeToText(input, source, sourceOptions),
    target,
    targetOptions,
  );
}

function canDecodeBase64(input: string, type: "base64" | "base64url"): boolean {
  try {
    decodeBase64(input, type);

    return true;
  } catch {
    return false;
  }
}

export function detectEncoding(input: string): EncodingDetection | null {
  const trimmed = input.trim();

  if (!trimmed) return null;

  if (/\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]{1,6}\})/u.test(trimmed)) {
    return { type: "unicode", confidence: "high" };
  }

  if (/(?:%[0-9a-fA-F]{2}){2,}/u.test(trimmed)) {
    return { type: "url", confidence: "high" };
  }

  const binaryWithoutPrefixes = trimmed.replace(/0b/gi, "");
  const compactBinary = binaryWithoutPrefixes.replace(/[\s,;:_-]+/g, "");
  const hasExplicitBinaryShape =
    /0b[01]{8}/iu.test(trimmed) || /(?:^|\s)[01]{8}(?:\s|$)/u.test(trimmed);

  if (
    hasExplicitBinaryShape &&
    compactBinary.length % 8 === 0 &&
    /^[01]+$/u.test(compactBinary)
  ) {
    return { type: "binary", confidence: "high" };
  }

  const hexWithoutPrefixes = trimmed.replace(/0x/gi, "");
  const compactHex = hexWithoutPrefixes.replace(/[\s,;:_-]+/g, "");
  const hasExplicitHexShape =
    /0x[0-9a-fA-F]{2}/u.test(trimmed) ||
    /(?:^|\s)[0-9a-fA-F]{2}(?:\s+[0-9a-fA-F]{2})+(?:\s|$)/u.test(trimmed);

  if (
    hasExplicitHexShape &&
    compactHex.length % 2 === 0 &&
    /^[0-9a-fA-F]+$/u.test(compactHex)
  ) {
    return { type: "hex", confidence: "high" };
  }

  const compact = trimmed.replace(/\s+/g, "");

  if (
    compact.length >= 8 &&
    /[-_]/u.test(compact) &&
    canDecodeBase64(compact, "base64url")
  ) {
    return { type: "base64url", confidence: "high" };
  }

  if (
    compact.length >= 12 &&
    (/[+/=]/u.test(compact) || compact.length >= 20) &&
    canDecodeBase64(compact, "base64")
  ) {
    return { type: "base64", confidence: "high" };
  }

  return null;
}

export function getUtf8ByteLength(input: string): number {
  return utf8Encoder.encode(input).length;
}
