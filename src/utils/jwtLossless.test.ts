import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { encodeJwtLossless, decodeJwtLossless } from "./jwtLossless";
import { parseJson, stringifyJson } from "./json";
test("JWT preserves large payload integers across signing and decoding", () => {
  const payload = parseJson('{"id":900719925474099312345,"iat":1700000000}');
  const token = encodeJwtLossless(
    { typ: "JWT" },
    payload,
    "test-secret",
    "HS256",
  );
  assert.ok(
    stringifyJson(decodeJwtLossless(token).payload).includes(
      "900719925474099312345",
    ),
  );
  assert.doesNotThrow(() => jwt.verify(token, "test-secret"));
  assert.throws(() => jwt.verify(token, "wrong-secret"));
});
test("JWT rejects malformed encodings and unsafe header numbers explicitly", () => {
  assert.throws(() => decodeJwtLossless("broken"));
  assert.throws(() => decodeJwtLossless("%%%%.%%%%.invalid"));
  assert.throws(
    () =>
      encodeJwtLossless(
        parseJson('{"id":900719925474099312345}'),
        {},
        "secret",
        "HS256",
      ),
    /安全范围/,
  );
});
