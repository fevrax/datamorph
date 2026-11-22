import assert from "node:assert/strict";
import test from "node:test";
import { errorDetails, errorText, message, messageError } from "./diagnostics";
import { translate } from "./index";
import { normalizeLocale, resolveLocale, setLocalePreference } from "./locale";
import { messages } from "./messages";

test("browser language is used only without a valid saved preference", () => {
  for (const language of ["zh", "zh-CN", "zh-Hant-TW", "ZH-Hans-SG"])
    assert.equal(resolveLocale(undefined, language), "zh-CN");
  for (const language of ["en-US", "ja-JP", "fr-CA", undefined])
    assert.equal(resolveLocale(undefined, language), "en");
  assert.equal(resolveLocale("en", "zh-TW"), "en");
  assert.equal(resolveLocale("zh-CN", "en-US"), "zh-CN");
  assert.equal(resolveLocale("fr", "zh-TW"), "zh-CN");
  assert.equal(normalizeLocale({ locale: "en" }), undefined);
});

test("every message has a translation with the same interpolation parameters", () => {
  const placeholders = (text: string) =>
    [...text.matchAll(/\{\d+\}/g)].map(([token]) => token).sort();
  for (const [key, english] of Object.entries(messages)) {
    assert.ok(english.trim(), key);
    assert.deepEqual(placeholders(english), placeholders(key), key);
  }
  assert.equal(
    translate("en", "第 {0} 行 · 第 {1} 列", { 0: 3, 1: 8 }),
    "Line 3 · Column 8",
  );
});

test("worker diagnostics survive cloning and are translated at presentation time", () => {
  const result = structuredClone(
    errorDetails(
      messageError("请输入有效的{0}内容", { 0: message("十六进制") }),
    ),
  );
  try {
    setLocalePreference("zh-CN");
    assert.equal(errorText(result), "请输入有效的十六进制内容");
    setLocalePreference("en");
    assert.equal(errorText(result), "Enter valid hexadecimal content");
    assert.equal(errorText(new SyntaxError("Invalid token")), "Invalid token");
  } finally {
    setLocalePreference(undefined);
  }
});
