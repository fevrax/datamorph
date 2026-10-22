import { formatTimestamp } from "@/utils/timeZone";
import { decodeBase64Strict } from "@/utils/base64";
export type DecoderKind = "timestamp" | "base64" | "unicode" | "url" | "image";
export interface DecodedToken {
  kind: DecoderKind;
  start: number;
  end: number;
  raw: string;
  decoded: string;
}
export const TIMESTAMP_BLACKLIST = ["id", "url", "size", "count", "length"];
export const timestampToHumanReadable = formatTimestamp;
export function detectTokens(
  text: string,
  offset = 0,
  maxValueLength = 12000,
  timeZone = "local",
): DecodedToken[] {
  const results: DecodedToken[] = [];
  const strings = /"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = strings.exec(text)) && results.length < 250) {
    const raw = match[1];
    const matchIndex = match.index;
    if (/^\s*:/.test(text.slice(strings.lastIndex))) continue;
    const start = match.index + 1 + offset;
    const end = start + raw.length;
    const add = (kind: DecoderKind, decoded: string) => {
      if (decoded && decoded !== raw)
        results.push({ kind, start, end, raw, decoded });
    };
    if (/\\u[0-9a-f]{4}/i.test(raw)) {
      try {
        add("unicode", JSON.parse('"' + raw + '"'));
      } catch {
        /* malformed escape */
      }
    }
    if (/%[0-9a-f]{2}/i.test(raw)) {
      try {
        add("url", decodeURIComponent(raw));
      } catch {
        /* malformed URL */
      }
    }
    if (
      raw.length >= 8 &&
      raw.length <= maxValueLength &&
      /^[a-z\d+/_-]+={0,2}$/i.test(raw)
    ) {
      add("base64", decodeBase64Strict(raw));
    }
    if (
      /^https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|svg|bmp|ico)(?:[?#].*)?$/i.test(
        raw,
      )
    )
      results.push({ kind: "image", start, end, raw, decoded: raw });
    if (
      /^\d{10}(?:\d{3})?$/.test(raw) &&
      !TIMESTAMP_BLACKLIST.some((key) =>
        new RegExp('"' + key + '"\\s*:\\s*$', "i").test(
          text.slice(0, matchIndex),
        ),
      )
    )
      add("timestamp", timestampToHumanReadable(raw, timeZone));
  }
  const numbers =
    /(?:"([^"\\]+)"\s*:\s*|[\[,]\s*|^\s*)(\d{13}|\d{10})(?=\s*(?:[,}\]]|$))/g;
  while ((match = numbers.exec(text)) && results.length < 250) {
    if (match[1] && TIMESTAMP_BLACKLIST.includes(match[1].toLowerCase()))
      continue;
    const raw = match[2];
    const start = match.index + match[0].lastIndexOf(raw) + offset;
    results.push({
      kind: "timestamp",
      start,
      end: start + raw.length,
      raw,
      decoded: timestampToHumanReadable(raw, timeZone),
    });
  }
  return results;
}

/** Explicit hover may inspect the complete containing value, even on a long line. */
export function detectTokensAtPosition(
  line: string,
  column: number,
  timeZone = "local",
): DecodedToken[] {
  let opening = -1;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    if (opening >= 0) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (line[i] === "\\") {
        escaped = true;
        continue;
      }
      if (line[i] === '"') {
        if (column > opening && column <= i) {
          // Include the property name for timestamp blacklist detection.
          const from = Math.max(0, line.lastIndexOf(":", opening) - 64);
          const prefix = line.slice(from, opening);
          const key = prefix.match(/"([^"\\]+)"\s*:\s*$/)?.[0] || "";
          const text =
            key + line.slice(opening, i + 1) + line.slice(i + 1, i + 3);
          return detectTokens(
            text,
            opening - key.length,
            Infinity,
            timeZone,
          ).filter((t) => column >= t.start && column <= t.end);
        }
        opening = -1;
        if (i > column) break;
      }
    } else if (line[i] === '"') opening = i;
  }
  const start = Math.max(0, column - 128);
  return detectTokens(
    line.slice(start, column + 128),
    start,
    12000,
    timeZone,
  ).filter((t) => column >= t.start && column <= t.end);
}
