import type { Plugin } from "prettier";
import { EXTRA_FORMAT_LANGUAGES } from "../utils/dataFormats";

type ProtoFormatter = Pick<typeof import("@wasm-fmt/clang-format"), "format">;
let protoFormatter: Promise<ProtoFormatter> | undefined;
function loadProtoFormatter(): Promise<ProtoFormatter> {
  return (protoFormatter ??= import("@wasm-fmt/clang-format/vite")
    .then(async (module) => {
      await module.default();
      return module;
    })
    .catch((error) => {
      protoFormatter = undefined;
      throw error;
    }));
}

export interface FormatTaskInput {
  action: "format-code";
  content: string;
  language: string;
  indent?: number;
  insertSpaces?: boolean;
}

export async function executeFormatTask(
  { content, language, indent = 2, insertSpaces = true }: FormatTaskInput,
  loadProto: () => Promise<ProtoFormatter> = loadProtoFormatter,
): Promise<{ content: string }> {
  if (!EXTRA_FORMAT_LANGUAGES.some((id) => id === language))
    throw new Error(`${language.toUpperCase()} 暂不支持格式化`);
  if (!content.trim()) return { content };
  if (language === "proto") {
    const { format } = await loadProto();
    return {
      content: format(
        content,
        "document.proto",
        JSON.stringify({
          BasedOnStyle: "Google",
          Language: "Proto",
          IndentWidth: indent,
          TabWidth: indent,
          UseTab: insertSpaces ? "Never" : "Always",
          SortIncludes: "Never",
          ReflowComments: "Never",
        }),
      ),
    };
  }
  if (language === "sql") {
    const { format } = await import("sql-formatter");
    return {
      content: format(content, {
        language: "sql",
        tabWidth: indent,
        useTabs: !insertSpaces,
      }),
    };
  }
  const { format } = await import("prettier/standalone");
  const plugins =
    language === "yaml"
      ? [await import("prettier/plugins/yaml")]
      : language === "markdown"
        ? [await import("prettier/plugins/markdown")]
        : [
            await import("prettier/plugins/babel"),
            (await import("prettier/plugins/estree")) as Plugin,
          ];
  return {
    content: await format(content, {
      parser: language === "jsonc" ? "json" : language,
      plugins,
      tabWidth: indent,
      useTabs: !insertSpaces,
      endOfLine: "auto",
      embeddedLanguageFormatting: "off",
    }),
  };
}
