import {
  getEditorWorkload,
  getHistoryContentHash,
  getValidationDelay,
  isHistoryContentTooLarge,
  scheduleInlineDecorationUpdate,
  shouldRunInlineDecorations,
} from "./editorPerformance";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createModel(chars: number, lines: number) {
  return {
    getValueLength: () => chars,
    getLineCount: () => lines,
  };
}

const smallWorkload = getEditorWorkload(createModel(999_999, 20_000));

assert(!smallWorkload.isLarge, "small workload should not be large");
assert(
  shouldRunInlineDecorations(smallWorkload),
  "small files should run inline decorations",
);
assert(
  getValidationDelay(smallWorkload) === 500,
  "small files should validate after 500ms",
);

const largeByChars = getEditorWorkload(createModel(1_000_001, 10));

assert(
  largeByChars.isLarge,
  "files larger than 1,000,000 chars should be large",
);
assert(
  shouldRunInlineDecorations(largeByChars),
  "large files retain visible-range decorations",
);
assert(
  getValidationDelay(largeByChars) === 1500,
  "large files should validate after 1500ms",
);

const largeByLines = getEditorWorkload(createModel(10, 20_001));

assert(
  largeByLines.isLarge,
  "files with more than 20,000 lines should be large",
);
assert(
  isHistoryContentTooLarge("x".repeat(1_000_001)),
  "large history content should be truncated",
);
assert(
  !isHistoryContentTooLarge("x".repeat(1_000_000)),
  "threshold-sized history content should be kept",
);
assert(
  getHistoryContentHash("same content") ===
    getHistoryContentHash("same content"),
  "same history content should produce stable hashes",
);
assert(
  getHistoryContentHash("same content") !==
    getHistoryContentHash("other content"),
  "different history content should produce different hashes",
);

let scheduled = false;
const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = {
  current: null,
};

scheduleInlineDecorationUpdate({
  timeoutRef,
  workload: largeByLines,
  delay: 0,
  run: () => {
    scheduled = true;
  },
});

assert(!scheduled, "large files should not schedule inline decoration work");
assert(
  timeoutRef.current !== null,
  "large files schedule bounded visible-range work",
);

scheduleInlineDecorationUpdate({
  timeoutRef,
  workload: smallWorkload,
  delay: 0,
  run: () => {
    scheduled = true;
  },
});

assert(
  timeoutRef.current !== null,
  "small files should schedule inline decoration work",
);

if (timeoutRef.current) {
  clearTimeout(timeoutRef.current);
}
