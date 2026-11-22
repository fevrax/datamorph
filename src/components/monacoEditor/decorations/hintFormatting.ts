import type { DecoderKind } from "./detectors";

const MAX_INLINE_PREVIEW_CHARS = 18;
const MAX_LINE_TIMESTAMPS_JSON = 2;
const MAX_LINE_DECODED_ITEMS = 1;

export function truncateInlinePreview(
  text: string,
  maxChars = MAX_INLINE_PREVIEW_CHARS,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) return normalized;
  return chars.slice(0, maxChars).join("") + "…";
}

export function formatDecoderPillText(
  kind: DecoderKind,
  values: readonly string[],
  options: { plainText?: boolean; imageLabel?: string } = {},
): string | null {
  if (!values.length) return null;
  if (kind === "timestamp") {
    if (options.plainText || values.length <= MAX_LINE_TIMESTAMPS_JSON) {
      return values.join(" · ");
    }
    const extra = values.length - MAX_LINE_TIMESTAMPS_JSON;
    return `${values.slice(0, MAX_LINE_TIMESTAMPS_JSON).join(" · ")} · +${extra}`;
  }
  if (kind === "image") {
    const label = options.imageLabel || "Image";
    return values.length > 1 ? `${label} ×${values.length}` : label;
  }
  const prefix =
    kind === "base64" ? "Base64" : kind === "unicode" ? "Unicode" : "URL";
  const preview = truncateInlinePreview(values[0]);
  if (!preview) return null;
  const suffix =
    values.length > MAX_LINE_DECODED_ITEMS
      ? ` · +${values.length - MAX_LINE_DECODED_ITEMS}`
      : "";
  return `${prefix} → ${preview}${suffix}`;
}
