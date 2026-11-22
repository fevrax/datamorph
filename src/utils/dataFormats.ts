import { t } from "@/i18n";
export type LanguageMode = "auto" | "manual";
export const DEFAULT_TAB_NAME_PREFIX = "New Tab";
export const UNTITLED_DOCUMENT_NAME = `${DEFAULT_TAB_NAME_PREFIX} 1`;
const DEFAULT_TAB_NAME_PATTERN = /^New Tab (\d+)$/;
export function formatDefaultTabName(index: number): string {
  const normalized = Number.isSafeInteger(index) && index >= 1 ? index : 1;
  return `${DEFAULT_TAB_NAME_PREFIX} ${normalized}`;
}
export function parseDefaultTabNumber(title?: string): number | null {
  if (!title) return null;
  const match = DEFAULT_TAB_NAME_PATTERN.exec(title.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}
export function isLegacyUntitledDocumentName(title?: string): boolean {
  return (
    !title ||
    title === "未命名" ||
    title === "未命名.json" ||
    title === "Untitled"
  );
}
export function isDefaultDocumentName(title?: string): boolean {
  return (
    isLegacyUntitledDocumentName(title) || parseDefaultTabNumber(title) !== null
  );
}
export function maxDefaultTabNumber(
  tabs: readonly { title?: string }[],
): number {
  let max = 0;
  for (const tab of tabs) {
    const num = parseDefaultTabNumber(tab.title);
    if (num !== null && num > max) max = num;
  }
  return max;
}
export function nextDefaultTabNumber(
  tabs: readonly { title?: string }[],
  minNext = 1,
): number {
  return Math.max(minNext, maxDefaultTabNumber(tabs) + 1);
}
export function assignMissingDefaultTabNames<
  T extends {
    kind: string;
    title: string;
    autoNamed?: boolean;
    editorSettings: { filename?: string };
  },
>(tabs: readonly T[]): T[] {
  const used = new Set<number>();
  for (const tab of tabs) {
    const num = parseDefaultTabNumber(tab.title);
    if (num !== null) used.add(num);
  }
  let next = 1;
  const allocate = () => {
    while (used.has(next)) next++;
    used.add(next);
    return formatDefaultTabName(next++);
  };
  return tabs.map((tab) =>
    tab.kind === "document" &&
    !tab.editorSettings.filename &&
    !tab.autoNamed &&
    isLegacyUntitledDocumentName(tab.title)
      ? { ...tab, title: allocate() }
      : tab,
  );
}
// id is the concrete Monaco language ID; highlighter selects the bundled definition.
export const DATA_FORMATS = [
  {
    id: "json",
    highlighter: "builtin",
    name: "JSON",
    extensions: ["json"],
    jsonOperations: true,
  },
  {
    id: "jsonc",
    highlighter: "jsonc",
    name: "JSONC",
    extensions: ["jsonc"],
    jsonOperations: false,
  },
  {
    id: "json5",
    highlighter: "json5",
    name: "JSON5",
    extensions: ["json5"],
    jsonOperations: true,
  },
  {
    id: "yaml",
    highlighter: "builtin",
    name: "YAML",
    extensions: ["yaml", "yml"],
    jsonOperations: false,
  },
  {
    id: "toml",
    highlighter: "toml",
    name: "TOML",
    extensions: ["toml"],
    jsonOperations: false,
  },
  {
    id: "xml",
    highlighter: "builtin",
    name: "XML",
    extensions: ["xml"],
    jsonOperations: false,
  },
  {
    id: "csv",
    highlighter: "csv",
    name: "CSV",
    extensions: ["csv"],
    jsonOperations: false,
  },
  {
    id: "tsv",
    highlighter: "tsv",
    name: "TSV",
    extensions: ["tsv"],
    jsonOperations: false,
  },
  {
    id: "ini",
    highlighter: "builtin",
    name: "INI",
    extensions: ["ini"],
    jsonOperations: false,
  },
  {
    id: "ndjson",
    highlighter: "jsonc",
    name: "NDJSON",
    extensions: ["ndjson", "jsonl"],
    jsonOperations: false,
  },
  {
    id: "html",
    highlighter: "builtin",
    name: "HTML",
    extensions: ["html", "htm"],
    jsonOperations: false,
  },
  {
    id: "css",
    highlighter: "builtin",
    name: "CSS",
    extensions: ["css"],
    jsonOperations: false,
  },
  {
    id: "scss",
    highlighter: "builtin",
    name: "SCSS",
    extensions: ["scss"],
    jsonOperations: false,
  },
  {
    id: "less",
    highlighter: "builtin",
    name: "LESS",
    extensions: ["less"],
    jsonOperations: false,
  },
  {
    id: "sql",
    highlighter: "builtin",
    name: "SQL",
    extensions: ["sql"],
    jsonOperations: false,
  },
  {
    id: "javascript",
    highlighter: "builtin",
    name: "JavaScript",
    extensions: ["js", "mjs", "cjs", "jsx"],
    jsonOperations: false,
  },
  {
    id: "typescript",
    highlighter: "builtin",
    name: "TypeScript",
    extensions: ["ts", "mts", "cts", "tsx"],
    jsonOperations: false,
  },
  {
    id: "markdown",
    highlighter: "builtin",
    name: "Markdown",
    extensions: ["md", "markdown"],
    jsonOperations: false,
  },
  {
    id: "proto",
    highlighter: "builtin",
    name: "Protobuf",
    extensions: ["proto"],
    jsonOperations: false,
  },
  {
    id: "plaintext",
    highlighter: "builtin",
    get name() {
      return t("普通文本");
    },
    extensions: ["txt"],
    jsonOperations: false,
  },
] as const;
export type DataFormat = (typeof DATA_FORMATS)[number]["id"];
export const DATA_FILE_ACCEPT = DATA_FORMATS.flatMap((f) =>
  f.extensions.map((ext) => "." + ext),
).join(",");
export function formatFromFilename(filename?: string): DataFormat | undefined {
  const ext = filename?.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  return DATA_FORMATS.find((f) => f.extensions.some((e: string) => e === ext))
    ?.id;
}
export function supportsJsonOperations(language: string): boolean {
  return DATA_FORMATS.some((f) => f.id === language && f.jsonOperations);
}
export const MONACO_FORMAT_LANGUAGES = [
  "html",
  "css",
  "scss",
  "less",
  "javascript",
  "typescript",
] as const;
export const EXTRA_FORMAT_LANGUAGES = [
  "sql",
  "yaml",
  "jsonc",
  "markdown",
  "proto",
] as const;
export function supportsFormatting(language: string): boolean {
  return (
    supportsJsonOperations(language) ||
    [...MONACO_FORMAT_LANGUAGES, ...EXTRA_FORMAT_LANGUAGES].some(
      (id) => id === language,
    )
  );
}
export function documentDownloadName(
  title: string | undefined,
  language: string,
  filename?: string,
): string {
  if (filename) return title || filename;
  const extension =
    DATA_FORMATS.find((f) => f.id === language)?.extensions[0] || "txt";
  if (title && !isDefaultDocumentName(title)) {
    return formatFromFilename(title) ? title : `${title}.${extension}`;
  }
  const base =
    title && parseDefaultTabNumber(title) !== null
      ? title.trim()
      : UNTITLED_DOCUMENT_NAME;
  return `${base}.${extension}`;
}
