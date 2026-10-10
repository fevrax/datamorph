import * as monaco from "monaco-editor";
import {
  detectTokens,
  detectTokensAtPosition,
  type DecoderKind,
  type DecodedToken,
} from "./detectors";
import { useSettingsStore } from "@/store/useSettingsStore";
import clipboard from "@/utils/clipboard";
import { useTabStore } from "@/store/useTabStore";
interface Entry {
  editor: monaco.editor.IStandaloneCodeEditor;
  enabled: Map<DecoderKind, boolean>;
  collections: Map<DecoderKind, monaco.editor.IEditorDecorationsCollection>;
  version: number;
  position: string;
  tokens: Array<DecodedToken & { line: number }>;
}
const entries = new Map<string, Entry>();
let registered = false;
const enabledKey = {
  timestamp: "timestampDecoderEnabled",
  base64: "base64DecoderEnabled",
  unicode: "unicodeDecoderEnabled",
  url: "urlDecoderEnabled",
  image: "imageDecoderEnabled",
} as const;
function active(entry: Entry, kind: DecoderKind) {
  return (
    entry.enabled.get(kind) !== false &&
    useSettingsStore.getState()[enabledKey[kind]] !== false
  );
}
function getEntry(editor: monaco.editor.IStandaloneCodeEditor) {
  let entry = entries.get(editor.getId());
  if (entry) return entry;
  entry = {
    editor,
    enabled: new Map(),
    collections: new Map(),
    version: -1,
    position: "",
    tokens: [],
  };
  entries.set(editor.getId(), entry);
  editor.onDidDispose(() => {
    entries.delete(editor.getId());
  });
  return entry;
}
function scan(entry: Entry) {
  const editor = entry.editor,
    model = editor.getModel();
  if (!model) return [];
  const ranges = editor.getVisibleRanges();
  const signature =
    JSON.stringify(ranges) + ":" + Math.floor(editor.getScrollLeft());
  if (entry.version === model.getVersionId() && entry.position === signature)
    return entry.tokens;
  const tokens: Entry["tokens"] = [];
  const seen = new Set<number>();
  const maxLines = 300;
  for (const range of ranges) {
    for (
      let line = Math.max(1, range.startLineNumber - 8);
      line <= Math.min(model.getLineCount(), range.endLineNumber + 8) &&
      seen.size < maxLines;
      line++
    ) {
      if (seen.has(line)) continue;
      seen.add(line);
      const column =
        line === range.startLineNumber ? Math.max(0, range.startColumn - 1) : 0;
      const horizontal = Math.floor(editor.getScrollLeft() / 8);
      const start = Math.max(0, column + horizontal - 1000);
      const end = Math.min(model.getLineMaxColumn(line), start + 8000);
      const text = model.getValueInRange(
        new monaco.Range(line, start + 1, line, end),
      );
      for (const token of detectTokens(text, start))
        tokens.push({ ...token, line });
    }
  }
  entry.version = model.getVersionId();
  entry.position = signature;
  entry.tokens = tokens;
  return tokens;
}
export function updateDecoder(
  kind: DecoderKind,
  editor: monaco.editor.IStandaloneCodeEditor,
  state: { enabled: boolean },
) {
  registerDecoderProviders();
  const entry = getEntry(editor);
  entry.enabled.set(kind, state.enabled);
  let collection = entry.collections.get(kind);
  if (!collection) {
    collection = editor.createDecorationsCollection();
    entry.collections.set(kind, collection);
  }
  if (!active(entry, kind)) {
    collection.clear();
    return;
  }
  const tokens = scan(entry).filter((t) => t.kind === kind);
  collection.set(
    tokens.map((t) => ({
      range: new monaco.Range(t.line, t.start + 1, t.line, t.end + 1),
      options: {
        inlineClassName: "json-decoded-value",
        ...(kind === "timestamp"
          ? {
              after: {
                content: "  " + t.decoded,
                inlineClassName: "json-decoded-hint",
                cursorStops: monaco.editor.InjectedTextCursorStops.None,
              },
            }
          : {}),
      },
    })),
  );
}
export function clearDecoder(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  kind: DecoderKind,
) {
  if (!editor) return;
  const entry = entries.get(editor.getId());
  entry?.collections.get(kind)?.clear();
  if (entry) entry.version = -1;
}
export function clearEditorDecoders(
  editor: monaco.editor.IStandaloneCodeEditor,
) {
  const entry = entries.get(editor.getId());
  entry?.collections.forEach((c) => c.clear());
  entries.delete(editor.getId());
}
export function refreshGlobalDecoders() {
  queueMicrotask(() =>
    entries.forEach((entry) =>
      entry.enabled.forEach((enabled, kind) =>
        updateDecoder(kind, entry.editor, { enabled }),
      ),
    ),
  );
}
function escapeMarkdown(text: string) {
  return text.replace(/[\\`*_{}\[\]()<>#+.!|]/g, "\\$&");
}
const titles = {
  timestamp: "时间戳",
  base64: "Base64 解码",
  unicode: "Unicode 解码",
  url: "URL 解码",
  image: "图片预览",
};
export function registerDecoderProviders() {
  if (registered) return;
  registered = true;
  monaco.editor.registerCommand(
    "jsonTools.copyDecoded",
    (_accessor, value: string) => {
      if (typeof value === "string") void clipboard.copy(value, "已复制");
    },
  );
  monaco.editor.registerCommand(
    "jsonTools.openDecoded",
    (_accessor, value: string) => {
      if (typeof value === "string")
        useTabStore.getState().addTab("decoded.json", value);
    },
  );
  monaco.editor.registerCommand(
    "jsonTools.openLink",
    (_accessor, value: string) => {
      if (typeof value === "string" && /^https?:\/\//i.test(value))
        window.open(value, "_blank", "noopener,noreferrer");
    },
  );
  monaco.editor.registerCommand(
    "jsonTools.previewImage",
    (_accessor, url: string) => {
      if (typeof url === "string" && /^https?:\/\//.test(url))
        window.dispatchEvent(
          new CustomEvent("json-tools:preview-image", { detail: url }),
        );
    },
  );
  monaco.languages.registerHoverProvider(["json", "json5"], {
    provideHover(model, position) {
      const entry =
        [...entries.values()].find(
          (e) => e.editor.getModel() === model && e.editor.hasTextFocus(),
        ) || [...entries.values()].find((e) => e.editor.getModel() === model);
      if (!entry) return null;
      const matches = detectTokensAtPosition(
        model.getLineContent(position.lineNumber),
        position.column - 1,
      ).filter((t) => active(entry, t.kind));
      if (!matches.length) return null;
      return {
        range: new monaco.Range(
          position.lineNumber,
          matches[0].start + 1,
          position.lineNumber,
          matches[0].end + 1,
        ),
        contents: matches.flatMap((t) => {
          const args = encodeURIComponent(JSON.stringify([t.decoded]));
          return [
            { value: "**" + titles[t.kind] + "**" },
            t.kind === "image"
              ? {
                  value: `[打开图片预览](command:jsonTools.previewImage?${args})`,
                  isTrusted: { enabledCommands: ["jsonTools.previewImage"] },
                }
              : { value: escapeMarkdown(t.decoded.slice(0, 12000)) },
            {
              value:
                `[复制](command:jsonTools.copyDecoded?${args}) · [新标签打开](command:jsonTools.openDecoded?${args})` +
                (/^https?:\/\//i.test(t.decoded)
                  ? ` · [打开链接](command:jsonTools.openLink?${args})`
                  : ""),
              isTrusted: {
                enabledCommands: [
                  "jsonTools.copyDecoded",
                  "jsonTools.openDecoded",
                  "jsonTools.openLink",
                ],
              },
            },
          ];
        }),
      };
    },
  });
  useSettingsStore.subscribe(refreshGlobalDecoders);
}
export function decoderStats() {
  return {
    editors: entries.size,
    collections: [...entries.values()].reduce(
      (n, e) => n + e.collections.size,
      0,
    ),
  };
}
