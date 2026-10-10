import type { TextChange } from "@/store/useTabStore";
/** Monaco offsets are UTF-16 offsets into the previous version, including multi-cursor edits. */
export function applyTextChanges(
  text: string,
  changes: readonly TextChange[],
): string {
  for (const change of [...changes].sort(
    (a, b) => b.rangeOffset - a.rangeOffset,
  )) {
    text =
      text.slice(0, change.rangeOffset) +
      change.text +
      text.slice(change.rangeOffset + change.rangeLength);
  }
  return text;
}
