import JSON5 from "json5";
import { parseJson, stringifyJson } from "../utils/json";

export const SMART_LIMITS = {
  document: 16 * 1024 * 1024,
  entries: 200_000,
  depth: 256,
  value: 64 * 1024,
  preview: 8000,
  decorations: 160,
  cache: 192,
  cacheChars: 1_000_000,
  formatted: 256 * 1024,
} as const;

export interface SmartFlags {
  embeddedJson: boolean;
  color: boolean;
  summary: boolean;
}
export interface SmartEntry {
  start: number;
  end: number;
  kind: "object" | "array" | "string";
  count: number;
}
export interface SmartHint {
  start: number;
  end: number;
  kind: "embeddedJson" | "color" | "summary";
  label: string;
  preview?: string;
  content?: string;
  color?: string;
  truncated?: boolean;
}
export interface SmartIndex {
  entries: SmartEntry[];
  limited: boolean;
}

/** Iterative lexical index. No parsed document, recursion, or numeric conversion. */
export function indexSmartDocument(text: string): SmartIndex {
  const entries: SmartEntry[] = [];
  if (text.length > SMART_LIMITS.document) return { entries, limited: true };
  const stack: Array<SmartEntry & { seen: boolean }> = [];
  let limited = false;
  const add = (entry: SmartEntry) => {
    if (entries.length < SMART_LIMITS.entries) entries.push(entry);
    else limited = true;
  };
  const markValue = () => {
    const parent = stack[stack.length - 1];
    if (parent?.kind === "array" && !parent.seen) {
      parent.count++;
      parent.seen = true;
    }
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) continue;
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && !/[\r\n\u2028\u2029]/.test(text[i])) i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      let escapedContent = false;
      for (i++; i < text.length; i++) {
        if (text[i] === "\\") {
          escapedContent = true;
          i++;
        } else if (text[i] === c) break;
      }
      if (i >= text.length) break;
      let next = i + 1;
      // JSON5 permits comments between a property name and its colon.
      while (next < text.length) {
        if (/\s/.test(text[next])) next++;
        else if (text.startsWith("/*", next)) {
          const end = text.indexOf("*/", next + 2);
          if (end < 0) break;
          next = end + 2;
        } else if (text.startsWith("//", next)) {
          while (next < text.length && !/[\r\n\u2028\u2029]/.test(text[next]))
            next++;
        } else break;
      }
      if (text[next] !== ":") {
        markValue();
        // Only keep candidates for embedded JSON and colors.
        if (escapedContent || /[\s#{\[rRhH\\]/.test(text[start + 1] || ""))
          add({ start, end: i + 1, kind: "string", count: 0 });
      }
      continue;
    }
    if (c === "{" || c === "[") {
      markValue();
      if (stack.length >= SMART_LIMITS.depth) {
        // Stop instead of publishing partial counts for incomplete containers.
        limited = true;
        break;
      }
      const entry = {
        start: i,
        end: -1,
        kind: c === "{" ? ("object" as const) : ("array" as const),
        count: 0,
        seen: false,
      };
      add(entry);
      stack.push(entry);
    } else if (c === "}" || c === "]") {
      const entry = stack.pop();
      if (!entry || entry.kind !== (c === "}" ? "object" : "array")) break;
      entry.end = i + 1;
    } else if (c === ":") {
      const parent = stack[stack.length - 1];
      if (parent?.kind === "object") parent.count++;
    } else if (c === ",") {
      const parent = stack[stack.length - 1];
      if (parent) parent.seen = false;
    } else markValue();
  }
  return { entries: entries.filter((entry) => entry.end >= 0), limited };
}

/** Return a canonical, numeric-only CSS value, safe to insert in a style rule. */
export function parsePreviewColor(value: string): string | undefined {
  const text = value.trim();
  if (/^#(?:[a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(text))
    return text.toLowerCase();
  const match = /^(rgba?|hsla?)\(([^()]*)\)$/i.exec(text);
  if (!match || text.length > 100) return;
  const body = match[2].trim();
  const comma = body.includes(",");
  if (comma && body.includes("/")) return;
  const parts = comma
    ? body.split(/\s*,\s*/)
    : body.replace(/\s*\/\s*/, " ").split(/\s+/);
  if (parts.length < 3 || parts.length > 4) return;
  if (!comma && parts.length === 4 && !body.includes("/")) return;
  const number =
    /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?(%|deg|rad|turn|grad)?$/i;
  if (parts.some((part) => !number.test(part))) return;
  const alpha =
    parts[3] === undefined
      ? 1
      : parseFloat(parts[3]) / (parts[3].endsWith("%") ? 100 : 1);
  if (
    !Number.isFinite(alpha) ||
    alpha < 0 ||
    alpha > 1 ||
    (parts[3] && /[a-z]/i.test(parts[3].replace(/e[-+]?\d+/i, "")))
  )
    return;
  let rgb: number[];
  if (match[1].toLowerCase().startsWith("rgb")) {
    if (parts.slice(0, 3).some((part) => /[a-df-z]/i.test(part))) return;
    if (
      comma &&
      new Set(parts.slice(0, 3).map((part) => part.endsWith("%"))).size > 1
    )
      return;
    rgb = parts
      .slice(0, 3)
      .map((part) => parseFloat(part) * (part.endsWith("%") ? 2.55 : 1));
    if (rgb.some((v) => !Number.isFinite(v) || v < 0 || v > 255.00001)) return;
  } else {
    if (
      !parts[1].endsWith("%") ||
      !parts[2].endsWith("%") ||
      parts[0].endsWith("%")
    )
      return;
    let hue = parseFloat(parts[0]);
    if (parts[0].endsWith("grad")) hue *= 0.9;
    else if (parts[0].endsWith("rad")) hue *= 180 / Math.PI;
    else if (parts[0].endsWith("turn")) hue *= 360;
    const s = parseFloat(parts[1]) / 100,
      l = parseFloat(parts[2]) / 100;
    if (![hue, s, l].every(Number.isFinite) || s < 0 || s > 1 || l < 0 || l > 1)
      return;
    hue = (((hue % 360) + 360) % 360) / 30;
    const a = s * Math.min(l, 1 - l);
    rgb = [0, 8, 4].map((n) => {
      const k = (n + hue) % 12;
      return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    });
  }
  return `rgba(${rgb.map((v) => Math.round(v)).join(", ")}, ${alpha})`;
}

function decodeString(source: string): string | undefined {
  try {
    let value: unknown;
    try {
      value = JSON.parse(source);
    } catch {
      value = JSON5.parse(source);
    }
    return typeof value === "string" ? value : undefined;
  } catch {
    return;
  }
}

function embeddedPreview(value: string): string | undefined {
  if (!/^\s*[\[{]/.test(value)) return;
  // Bound both recursion in the lossless parser and pretty-print expansion.
  let depth = 0,
    quote = false,
    escaped = false;
  for (const c of value) {
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quote = false;
    } else if (c === '"') quote = true;
    else if (c === "{" || c === "[") {
      if (++depth > 32) return;
    } else if (c === "}" || c === "]") depth--;
  }
  try {
    const formatted = stringifyJson(parseJson(value), 2);
    return formatted.length <= SMART_LIMITS.formatted ? formatted : undefined;
  } catch {
    return;
  }
}

export function describeSmartEntry(
  text: string,
  entry: SmartEntry,
  flags: SmartFlags,
): SmartHint[] {
  const { start, end, kind, count } = entry;
  if (kind !== "string")
    return flags.summary
      ? [
          {
            start,
            end,
            kind: "summary",
            label:
              kind === "array" ? `Array [ ${count} ]` : `Object { ${count} }`,
          },
        ]
      : [];
  if (end - start > SMART_LIMITS.value) return [];
  const value = decodeString(text.slice(start, end));
  if (value === undefined) return [];
  const hints: SmartHint[] = [];
  const color = flags.color ? parsePreviewColor(value) : undefined;
  if (color)
    hints.push({
      start,
      end,
      kind: "color",
      label: "颜色预览",
      preview: value === color ? value : `${value}\n${color}`,
      content: color,
      color,
    });
  if (flags.embeddedJson) {
    const formatted = embeddedPreview(value);
    if (formatted !== undefined)
      hints.push({
        start,
        end,
        kind: "embeddedJson",
        label: "JSON 字符串",
        preview: formatted.slice(0, SMART_LIMITS.preview),
        content: formatted,
        truncated: formatted.length > SMART_LIMITS.preview,
      });
  }
  return hints;
}

export function firstEntryAt(entries: SmartEntry[], offset: number): number {
  let low = 0,
    high = entries.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (entries[mid].start < offset) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Worker-owned document. Index reused across viewport changes; decoded values use a bounded LRU. */
export class SmartDocument {
  private index?: SmartIndex;
  private cache = new Map<number, SmartHint[]>();
  private flagsKey = "";
  private cacheChars = 0;
  indexBuilds = 0;
  constructor(public text: string) {}
  update(text: string) {
    this.text = text;
    this.index = undefined;
    this.cache.clear();
    this.cacheChars = 0;
  }
  getIndex() {
    if (!this.index) {
      this.index = indexSmartDocument(this.text);
      this.indexBuilds++;
    }
    return this.index;
  }
  describe(entry: SmartEntry, flags: SmartFlags) {
    const key = `${flags.embeddedJson}:${flags.color}:${flags.summary}`;
    if (key !== this.flagsKey) {
      this.cache.clear();
      this.cacheChars = 0;
      this.flagsKey = key;
    }
    let hints = this.cache.get(entry.start);
    if (!hints) {
      hints = describeSmartEntry(this.text, entry, flags);
      this.cacheChars += hints.reduce(
        (size, hint) =>
          size + (hint.content?.length || 0) + (hint.preview?.length || 0),
        0,
      );
    }
    this.cache.delete(entry.start);
    this.cache.set(entry.start, hints);
    while (
      this.cache.size > SMART_LIMITS.cache ||
      this.cacheChars > SMART_LIMITS.cacheChars
    ) {
      const oldest = this.cache.keys().next().value!;
      this.cacheChars -= this.cache
        .get(oldest)!
        .reduce(
          (size, hint) =>
            size + (hint.content?.length || 0) + (hint.preview?.length || 0),
          0,
        );
      this.cache.delete(oldest);
    }
    return hints;
  }
  visible(
    ranges: Array<{ start: number; end: number }>,
    flags: SmartFlags,
    collapsedLines: Array<{ start: number; end: number }> = [],
  ): SmartHint[] {
    const { entries } = this.getIndex();
    // Embedded JSON is decoded on hover only; scrolling never formats it.
    const inlineFlags = { ...flags, embeddedJson: false };
    const collapsedStarts = new Set<number>();
    if (flags.summary)
      for (const line of collapsedLines) {
        let candidate: SmartEntry | undefined;
        for (
          let i = firstEntryAt(entries, line.start);
          i < entries.length && entries[i].start < line.end;
          i++
        )
          if (entries[i].kind !== "string" && entries[i].end > line.end)
            candidate = entries[i];
        // Monaco folds the innermost container when opening brackets share a line.
        if (candidate) collapsedStarts.add(candidate.start);
      }
    const hints: SmartHint[] = [],
      seen = new Set<number>();
    for (const range of ranges) {
      let i = firstEntryAt(entries, range.start);
      // A wrapped long string may begin before the visible range.
      if (
        i > 0 &&
        entries[i - 1].kind === "string" &&
        entries[i - 1].end > range.start
      )
        i--;
      for (; i < entries.length && entries[i].start <= range.end; i++) {
        if (hints.length >= SMART_LIMITS.decorations) return hints;
        if (seen.has(entries[i].start)) continue;
        seen.add(entries[i].start);
        if (entries[i].kind === "string" && !flags.color) continue;
        // Expanded containers consume neither decoding work nor the hint budget.
        if (
          entries[i].kind !== "string" &&
          !collapsedStarts.has(entries[i].start)
        )
          continue;
        for (const hint of this.describe(entries[i], inlineFlags)) {
          if (hints.length >= SMART_LIMITS.decorations) break;
          // Never send decoded content across the thread boundary during scrolling.
          hints.push({
            start: hint.start,
            end: hint.end,
            kind: hint.kind,
            label: hint.label,
            color: hint.color,
          });
        }
      }
    }
    return hints;
  }
  hover(offset: number, flags: SmartFlags): SmartHint[] {
    const { entries } = this.getIndex();
    const i = firstEntryAt(entries, offset);
    const entry = entries[i]?.start === offset ? entries[i] : entries[i - 1];
    if (!entry || offset >= entry.end || entry.kind !== "string") return [];
    return this.describe(entry, flags);
  }
}
