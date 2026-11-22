import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDecoderPillText,
  truncateInlinePreview,
} from "../components/monacoEditor/decorations/hintFormatting";

test("truncateInlinePreview normalizes whitespace and preserves surrogate pairs", () => {
  assert.equal(truncateInlinePreview("  hello\n\tworld  "), "hello world");
  assert.equal(truncateInlinePreview("😀".repeat(6), 4), "😀😀😀😀…");
  assert.equal(truncateInlinePreview("Datamorph", 24), "Datamorph");
});

test("formatDecoderPillText formats each decoder kind concisely", () => {
  assert.equal(
    formatDecoderPillText("timestamp", ["2025-06-22 11:39:46"]),
    "2025-06-22 11:39:46",
  );
  assert.equal(
    formatDecoderPillText(
      "timestamp",
      ["2026-10-27 23:59:59", "2026-10-28 00:00:00"],
      { plainText: true },
    ),
    "2026-10-27 23:59:59 · 2026-10-28 00:00:00",
  );
  assert.equal(
    formatDecoderPillText("timestamp", [
      "2025-06-22 11:39:46",
      "2025-06-22 11:41:01",
      "2025-06-22 11:42:00",
    ]),
    "2025-06-22 11:39:46 · 2025-06-22 11:41:01 · +1",
  );
  assert.equal(
    formatDecoderPillText("base64", ["Datamorph"]),
    "Base64 → Datamorph",
  );
  assert.equal(
    formatDecoderPillText("base64", ["first", "second"]),
    "Base64 → first · +1",
  );
  assert.equal(
    formatDecoderPillText("unicode", ["朝阳区"]),
    "Unicode → 朝阳区",
  );
  assert.equal(formatDecoderPillText("url", ["张三"]), "URL → 张三");
  assert.equal(
    formatDecoderPillText("image", ["https://example.com/a.png"], {
      imageLabel: "图片",
    }),
    "图片",
  );
  assert.equal(
    formatDecoderPillText(
      "image",
      ["https://example.com/a.png", "https://example.com/b.png"],
      { imageLabel: "图片" },
    ),
    "图片 ×2",
  );
  assert.equal(formatDecoderPillText("base64", ["   \n\t "]), null);
  assert.equal(formatDecoderPillText("timestamp", []), null);
});
