export type LanguageMode = "auto" | "manual";
export const UNTITLED_DOCUMENT_NAME = "未命名";
export function isDefaultDocumentName(title?: string): boolean {
  return !title || title === UNTITLED_DOCUMENT_NAME || title === "未命名.json";
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
] as const;
export type DataFormat = (typeof DATA_FORMATS)[number]["id"];
export const DATA_FILE_ACCEPT = DATA_FORMATS.flatMap((f) =>
  f.extensions.map((ext) => "." + ext),
)
  .concat(".txt")
  .join(",");
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
  if (title && !isDefaultDocumentName(title)) return title;
  return (
    "未命名." +
    (DATA_FORMATS.find((f) => f.id === language)?.extensions[0] || "txt")
  );
}
