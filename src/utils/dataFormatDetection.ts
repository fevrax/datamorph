import JSON5 from "json5";
import YAML from "js-yaml";
import TOML from "@iarna/toml";
import { xml2js } from "xml-js";
import { formatFromFilename, type DataFormat } from "./dataFormats";

// Replace comments only outside strings, preserving offsets and line breaks.
export function stripJsonComments(text: string): string {
  let result = "",
    quote = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      result += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quote = false;
    } else if (c === '"') {
      quote = true;
      result += c;
    } else if (c === "/" && text[i + 1] === "/") {
      result += "  ";
      i++;
      while (i + 1 < text.length && !/[\r\n]/.test(text[i + 1])) {
        result += " ";
        i++;
      }
    } else if (c === "/" && text[i + 1] === "*") {
      result += "  ";
      i++;
      while (
        i + 1 < text.length &&
        !(text[i + 1] === "*" && text[i + 2] === "/")
      ) {
        i++;
        result += /[\r\n]/.test(text[i]) ? text[i] : " ";
      }
      if (i + 2 >= text.length) throw new Error("Unclosed comment");
      result += "  ";
      i += 2;
    } else result += c;
  }
  return result;
}
function withoutTrailingCommas(text: string): string {
  let result = "",
    quote = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!quote && c === "," && /^\s*[}\]]/.test(text.slice(i + 1))) continue;
    result += c;
    if (escaped) escaped = false;
    else if (quote && c === "\\") escaped = true;
    else if (c === '"') quote = !quote;
  }
  return result;
}
function accepts(parse: () => unknown): boolean {
  try {
    parse();
    return true;
  } catch {
    return false;
  }
}
function isDelimited(text: string, delimiter: string): boolean {
  const rows: number[] = [];
  let fields = 1,
    quoted = false,
    start = true,
    afterQuote = false,
    nonempty = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') i++;
        else {
          quoted = false;
          afterQuote = true;
        }
      }
      nonempty = true;
    } else if (c === '"' && start) {
      quoted = true;
      start = false;
      nonempty = true;
    } else if (c === delimiter) {
      fields++;
      start = true;
      afterQuote = false;
      nonempty = true;
    } else if (c === "\n" || c === "\r") {
      if (nonempty) rows.push(fields);
      fields = 1;
      start = true;
      afterQuote = false;
      nonempty = false;
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else {
      if (afterQuote) return false;
      if (c === '"') return false;
      start = false;
      nonempty = true;
    }
  }
  if (quoted) return false;
  if (nonempty) rows.push(fields);
  return rows.length >= 2 && rows[0] > 1 && rows.every((n) => n === rows[0]);
}
function hasYamlBlockStructure(lines: string[]): boolean {
  const entries = lines.filter(
    (line) => !/^\s*(?:#|---(?:\s+#.*)?$)/.test(line),
  );
  const blockEntry =
    /^[ \t]*(?:-\s+|(?:[\p{L}\p{N}_.-]+|"[^"\r\n]+"|'[^'\r\n]+'):(?:[ \t]|$))/u;
  // Multiple block entries still identify YAML when indentation or values are
  // invalid. The formatter remains responsible for reporting syntax errors.
  return (
    entries.length >= 2 &&
    blockEntry.test(entries[0]) &&
    entries.filter((line) => blockEntry.test(line)).length >= 2
  );
}
function looksIncomplete(text: string, previous?: DataFormat): boolean {
  if (previous === "json" || previous === "json5" || previous === "jsonc")
    return /^[{\[]/.test(text);
  if (previous === "xml") return text.startsWith("<");
  if (previous === "html") return text.startsWith("<");
  if (previous === "proto")
    return /^(?:syntax|edition|package|import|message|enum|service|extend|option)\b/.test(
      text,
    );
  if (["css", "scss", "less"].includes(previous || ""))
    return /[{}]|^[\w.#&@:$-]+\s*[:{]/.test(text);
  if (previous === "yaml") return /(^|\n)\s*(?:-\s|[^\n:]+:\s|---)/.test(text);
  if (previous === "toml" || previous === "ini")
    return /(^|\n)\s*(?:\[|[\w.-]+\s*=)/.test(text);
  if (previous === "ndjson") return /^[{\[]/.test(text);
  if (previous === "csv" || previous === "tsv")
    return text.includes(previous === "csv" ? "," : "\t");
  return false;
}
export function detectDataFormat(
  content: string,
  filename?: string,
  previous?: DataFormat,
): DataFormat {
  const hinted = formatFromFilename(filename);
  if (hinted) return hinted;
  const text = content.replace(/^\uFEFF/, "").trim();
  if (!text) return "json";
  if (accepts(() => JSON.parse(text))) return "json";
  if (
    /^[{\[/]/.test(text) &&
    accepts(() => JSON.parse(withoutTrailingCommas(stripJsonComments(text))))
  )
    return "jsonc";
  if (/^[{\[/]/.test(text) && accepts(() => JSON5.parse(text))) return "json5";
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (
    lines.length >= 2 &&
    lines.every((line) => accepts(() => JSON.parse(line)))
  )
    return "ndjson";
  // Only strong code signatures take precedence over the data parsers below.
  const code = text.replace(
    /^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$)|--[^\n]*(?:\n|$))*/,
    "",
  );
  if (
    /^(?:syntax\s*=\s*["']proto[23]["']|edition\s*=\s*["']\d{4}["']|(?:message|enum|service|extend)\s+[\w.]+\s*\{|package\s+[\w.]+\s*;|import\s+(?:(?:public|weak)\s+)?["'][^"'\r\n]+\.proto["'])/.test(
      code,
    )
  )
    return "proto";
  if (
    /^(?:<!doctype\s+html\b|<(?:html|head|body|div|span|p|a|ul|ol|li|table|form|input|button|script|style|section|main|article|h[1-6])(?:\s|>|\/))/i.test(
      code,
    )
  )
    return "html";
  if (
    /^(?:select\b[\s\S]+?\bfrom\b|with\s+[\w"]+\s+as\s*\(|insert\s+into\b|update\s+[\w".]+\s+set\b|delete\s+from\b|create\s+(?:table|view|index|database)\b|alter\s+table\b|drop\s+(?:table|view|index|database)\b)/i.test(
      code,
    )
  )
    return "sql";
  if (
    /^(?:(?:export\s+)?(?:interface\s+\w+\s*\{|type\s+\w+\s*=)|(?:export\s+)?(?:const|let)\s+\w+\s*:\s*\w+)/.test(
      code,
    )
  )
    return "typescript";
  if (
    /^(?:export\s+)?(?:const\s+\w+\s*=|let\s+\w+\s*=|(?:async\s+)?function\s+\w+\s*\(|import\s+(?:[\w*{]|["']))/.test(
      code,
    )
  )
    return previous === "typescript" ? previous : "javascript";
  if (
    /^(?:\$[\w-]+\s*:|@(?:mixin|include|use|forward|function)\b)/.test(code) ||
    (/\{[^}]*:[^}]+\}/.test(code) && /\$[\w-]+|@(?:mixin|include)\b/.test(code))
  )
    return "scss";
  if (/^@[\w-]+\s*:/.test(code)) return "less";
  if (
    !/:\s/.test(code.split("{")[0]) &&
    /^[^{}]+\{\s*(?:[\w-]+\s*:|[^{}]+\{)/.test(code)
  )
    return previous === "scss" || previous === "less" ? previous : "css";
  if (
    /^<(?:\?xml\b|[\w:]+[\s/>]|!--|!DOCTYPE\b)/i.test(text) &&
    accepts(() => xml2js(text))
  )
    return "xml";
  if (
    /(^|\n)\s*(?:[\w."'-]+\s*=|\[)/.test(text) &&
    accepts(() => TOML.parse(text))
  )
    return "toml";
  if (
    lines.some((line) => /^\s*[\w.-]+\s*=/.test(line)) &&
    lines.every((line) => /^\s*(?:[;#].*|\[[^\]]+\]|[\w.-]+\s*=.*)$/.test(line))
  )
    return "ini";
  if (
    (/(^|\n)\s*(?:-\s+|[^\n:]+:\s|---(?:\s|$))/.test(text) &&
      accepts(() => YAML.loadAll(text))) ||
    hasYamlBlockStructure(lines)
  )
    return "yaml";
  if (isDelimited(text, "\t")) return "tsv";
  if (isDelimited(text, ",")) return "csv";
  if (/^(?:#{1,6}\s+\S|```[\w-]*\s*\n)/.test(text)) return "markdown";
  return looksIncomplete(text, previous) && previous ? previous : "json";
}
