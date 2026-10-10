import jwt from "jsonwebtoken";
import { isLosslessNumber } from "lossless-json";
import { parseJson, stringifyJson } from "./json";
import { decodeToText, DEFAULT_ENCODING_OPTIONS } from "./encodingConverter";

function nativeHeader(value: unknown): unknown {
  if (isLosslessNumber(value)) {
    const native = value.valueOf();
    if (typeof native !== "number")
      throw new Error(
        "JWT Header 中的数字超出安全范围，请将该字段保存为字符串",
      );
    return native;
  }
  if (Array.isArray(value)) return value.map(nativeHeader);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, nativeHeader(item)]),
    );
  return value;
}
export function encodeJwtLossless(
  header: object,
  payload: object,
  secret: string,
  algorithm: string,
): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("无效的 payload 格式");
  const claims = { ...payload } as Record<string, unknown>;
  for (const name of ["iat", "nbf", "exp"]) {
    const value = claims[name];
    if (value !== undefined) {
      const native = isLosslessNumber(value) ? value.valueOf() : value;
      if (typeof native !== "number" || !Number.isFinite(native))
        throw new Error(`${name} 必须是有效的数字时间戳`);
    }
  }
  if (claims.iat === undefined) claims.iat = Math.floor(Date.now() / 1000);
  const normalized = nativeHeader({
    typ: "JWT",
    ...header,
    alg: algorithm,
  }) as jwt.JwtHeader;
  // A raw payload string prevents jsonwebtoken's native JSON serialization from rounding numbers.
  return jwt.sign(stringifyJson(claims), secret, {
    algorithm: algorithm as jwt.Algorithm,
    header: normalized,
  });
}
export function decodeJwtLossless(token: string): {
  header: Record<string, unknown>;
  payload: unknown;
} {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("无效的 JWT 格式，应包含三个部分");
  const decode = (part: string) =>
    parseJson(decodeToText(part, "base64url", DEFAULT_ENCODING_OPTIONS));
  const header = decode(parts[0]);
  if (!header || typeof header !== "object" || typeof header.alg !== "string")
    throw new Error("无效的 JWT Header");
  return { header, payload: decode(parts[1]) };
}
