import { test } from "node:test";
import assert from "node:assert/strict";
import { isImeComposing } from "./ime";

test("isImeComposing detects native, React, Safari keyCode 229, Process key, and tracked composition state", () => {
  assert.equal(
    isImeComposing({ key: "Enter", nativeEvent: { isComposing: true } }),
    true,
  );
  assert.equal(isImeComposing({ key: "Enter", isComposing: true }), true);
  assert.equal(
    isImeComposing({ key: "Enter", nativeEvent: { keyCode: 229 } }),
    true,
  );
  assert.equal(isImeComposing({ key: "Escape", keyCode: 229 }), true);
  assert.equal(isImeComposing({ key: "Process", keyCode: 13 }), true);
  assert.equal(isImeComposing({ key: "Enter", keyCode: 13 }, true), true);
});

test("isImeComposing returns false for normal non-composing keyboard events", () => {
  assert.equal(
    isImeComposing({
      key: "Enter",
      keyCode: 13,
      isComposing: false,
      nativeEvent: { isComposing: false, keyCode: 13 },
    }),
    false,
  );
  assert.equal(
    isImeComposing({
      key: "Escape",
      keyCode: 27,
      isComposing: false,
    }),
    false,
  );
});
