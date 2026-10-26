import * as monaco from "monaco-editor";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useTabStore } from "@/store/useTabStore";
import clipboard from "@/utils/clipboard";
import type { SmartFlags, SmartHint } from "@/workers/smartDisplay";
import type { SmartRequest } from "@/workers/smartDisplay.worker";

interface DisplayEntry {
  editor: monaco.editor.IStandaloneCodeEditor;
  refresh: () => void;
  dispose: () => void;
  hover: (
    position: monaco.Position,
    token: monaco.CancellationToken,
  ) => Promise<monaco.languages.Hover | null>;
  actions: SmartHint[];
  actionVersion: number;
  actionId: number;
}
const displays = new Map<string, DisplayEntry>();
let serial = 0;
let registered = false;
const flags = (): SmartFlags => {
  const state = useSettingsStore.getState();
  return {
    embeddedJson: state.embeddedJsonDecoderEnabled,
    color: state.colorDecoderEnabled,
    summary: state.summaryDecoderEnabled,
  };
};
const isEnabled = (editor: monaco.editor.IStandaloneCodeEditor) =>
  ["json", "json5"].includes(editor.getModel()?.getLanguageId() || "") &&
  Object.values(flags()).some(Boolean);
function plain(value: string) {
  return value.replace(/[\\`*_{}\[\]()<>#+.!|]/g, "\\$&");
}
function code(value: string, language: string) {
  const fence = "`".repeat(
    Math.max(
      3,
      ...[...value.matchAll(/`+/g)].map((match) => match[0].length + 1),
    ),
  );
  return `${fence}${language}\n${value}\n${fence}`;
}

export function attachSmartDisplay(
  editor: monaco.editor.IStandaloneCodeEditor,
) {
  if (displays.has(editor.getId())) return;
  registerSmartDisplay();
  // Let hover cards escape the editor panel instead of clipping at its top edge.
  editor.updateOptions({ fixedOverflowWidgets: true });
  const decorations = editor.createDecorationsCollection();
  const style = document.createElement("style");
  document.head.appendChild(style);
  const prefix = `smart-color-${++serial}`;
  let worker: Worker | undefined;
  let model = editor.getModel();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let viewId = 0,
    requestId = 0;
  let disposed = false;
  let lastHints: SmartHint[] = [];
  const pending = new Map<number, (value: SmartHint[] | null) => void>();
  const invalidate = () => {
    viewId = ++requestId;
    decorations.clear();
    lastHints = [];
    style.textContent = "";
    entry.actions = [];
    pending.forEach((resolve) => resolve(null));
    pending.clear();
  };
  const stop = () => {
    clearTimeout(timer);
    worker?.terminate();
    worker = undefined;
    invalidate();
  };
  const post = (request: SmartRequest) => worker?.postMessage(request);
  const isCollapsed = (line: number) =>
    !!model &&
    line < model.getLineCount() &&
    // Hidden lines map to the end of the preceding visible line, including wraps.
    editor.getTopForLineNumber(line + 1) <=
      editor.getTopForPosition(line, model.getLineMaxColumn(line));
  const render = (hints: SmartHint[]) => {
    if (!model) return;
    const rules: string[] = [];
    const values: monaco.editor.IModelDeltaDecoration[] = [];
    const visible = editor.getVisibleRanges();
    for (const hint of hints) {
      const start = model.getPositionAt(hint.start);
      if (hint.kind === "color" && hint.color) {
        const className = `${prefix}-${rules.length}`;
        // Worker colors are canonical numeric CSS, never source text or URLs.
        if (!/^(#[a-f\d]{3,8}|rgba\([\d., ]+\))$/i.test(hint.color)) continue;
        rules.push(`.${className}{background-color:${hint.color};}`);
        values.push({
          range: new monaco.Range(
            start.lineNumber,
            start.column,
            start.lineNumber,
            start.column,
          ),
          options: {
            showIfCollapsed: true,
            before: {
              content: "\u00a0",
              inlineClassName: `smart-color-swatch ${className}`,
              inlineClassNameAffectsLetterSpacing: true,
              cursorStops: monaco.editor.InjectedTextCursorStops.None,
            },
          },
        });
      } else if (hint.kind === "summary") {
        if (
          !visible.some(
            (range) =>
              start.lineNumber >= range.startLineNumber &&
              start.lineNumber <= range.endLineNumber,
          ) ||
          !isCollapsed(start.lineNumber)
        )
          continue;
        const anchor = new monaco.Position(
          start.lineNumber,
          model.getLineMaxColumn(start.lineNumber),
        );
        values.push({
          range: new monaco.Range(
            anchor.lineNumber,
            anchor.column,
            anchor.lineNumber,
            anchor.column,
          ),
          options: {
            showIfCollapsed: true,
            after: {
              content: `  ${hint.label}  `,
              inlineClassName:
                "json-decoded-hint smart-display-hint smart-fold-summary",
              cursorStops: monaco.editor.InjectedTextCursorStops.None,
            },
          },
        });
      }
    }
    style.textContent = rules.join("\n");
    decorations.set(values);
  };
  const start = () => {
    if (worker || !model || !isEnabled(editor)) return;
    worker = new Worker(
      new URL("../../../workers/smartDisplay.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (
      event: MessageEvent<{
        type: string;
        id: number;
        version: number;
        hints: SmartHint[];
      }>,
    ) => {
      const response = event.data;
      if (disposed || !model || response.version !== model.getVersionId())
        return;
      if (response.type === "visible") {
        if (response.id === viewId) {
          lastHints = response.hints;
          render(lastHints);
        }
      } else {
        pending.get(response.id)?.(response.hints);
        pending.delete(response.id);
      }
    };
    worker.onerror = stop;
    post({
      type: "sync",
      text: model.getValue(),
      version: model.getVersionId(),
    });
  };
  const refresh = (delay = 100) => {
    clearTimeout(timer);
    viewId = ++requestId;
    if (disposed || !isEnabled(editor)) {
      stop();
      return;
    }
    start();
    timer = setTimeout(() => {
      if (!model || !worker || disposed) return;
      const ranges = editor.getVisibleRanges();
      const currentFlags = flags();
      const collapsedLines: Array<{ start: number; end: number }> = [];
      if (currentFlags.summary)
        for (const range of ranges)
          for (
            let line = range.startLineNumber;
            line <= range.endLineNumber;
            line++
          )
            if (isCollapsed(line))
              collapsedLines.push({
                start: model.getOffsetAt(new monaco.Position(line, 1)),
                end: model.getOffsetAt(
                  new monaco.Position(line, model.getLineMaxColumn(line)),
                ),
              });
      post({
        type: "visible",
        id: viewId,
        version: model.getVersionId(),
        flags: currentFlags,
        collapsedLines,
        ranges: ranges.map((range) => ({
          start: model!.getOffsetAt(range.getStartPosition()),
          end: model!.getOffsetAt(range.getEndPosition()),
        })),
      });
    }, delay);
  };
  const subscriptions = [
    editor.onDidChangeModelContent((event) => {
      invalidate();
      if (worker && model) {
        if (event.isFlush)
          post({
            type: "sync",
            text: model.getValue(),
            version: model.getVersionId(),
          });
        else
          post({
            type: "change",
            changes: event.changes.map(
              ({ rangeOffset, rangeLength, text }) => ({
                rangeOffset,
                rangeLength,
                text,
              }),
            ),
            version: model.getVersionId(),
          });
      }
      refresh(300);
    }),
    editor.onDidScrollChange(() => refresh()),
    editor.onDidLayoutChange(() => refresh()),
    editor.onDidChangeHiddenAreas(() => {
      render(lastHints);
      refresh();
    }),
    editor.onDidChangeModelLanguage(() => {
      invalidate();
      refresh();
    }),
    editor.onDidChangeModel(() => {
      stop();
      model = editor.getModel();
      refresh();
    }),
    editor.onDidDispose(() => detachSmartDisplay(editor)),
  ];
  const entry: DisplayEntry = {
    editor,
    actions: [],
    actionVersion: -1,
    actionId: 0,
    refresh: () => {
      invalidate();
      refresh(0);
    },
    dispose: () => {
      disposed = true;
      stop();
      subscriptions.forEach((s) => s.dispose());
      style.remove();
    },
    hover: async (position, cancellation) => {
      if (!model || !isEnabled(editor) || cancellation.isCancellationRequested)
        return null;
      start();
      const version = model.getVersionId(),
        id = ++requestId;
      const hints = await new Promise<SmartHint[] | null>((resolve) => {
        const subscription = cancellation.onCancellationRequested(() => {
          pending.get(id)?.(null);
          pending.delete(id);
        });
        pending.set(id, (value) => {
          subscription.dispose();
          resolve(value);
        });
        post({
          type: "hover",
          id,
          version,
          flags: flags(),
          offset: model!.getOffsetAt(position),
        });
      });
      if (
        !hints?.length ||
        disposed ||
        cancellation.isCancellationRequested ||
        model.getVersionId() !== version
      )
        return null;
      entry.actions = hints;
      entry.actionVersion = version;
      entry.actionId = id;
      const contents: monaco.IMarkdownString[] = [];
      hints.forEach((hint, index) => {
        contents.push({ value: `**${plain(hint.label)}**` });
        if (hint.preview)
          contents.push({
            value: code(
              hint.preview,
              hint.kind === "embeddedJson" ? "json" : "text",
            ),
          });
        if (hint.truncated)
          contents.push({
            value: "预览已截断，复制或新标签打开可查看完整内容。",
          });
        if (hint.content !== undefined) {
          const args = encodeURIComponent(
            JSON.stringify([editor.getId(), id, index]),
          );
          contents.push({
            value: `[复制${hint.kind === "embeddedJson" ? " JSON" : "内容"}](command:datamorph.smartCopy?${args})${hint.kind === "color" ? "" : ` · [新标签打开](command:datamorph.smartOpen?${args})`}`,
            isTrusted: {
              enabledCommands: ["datamorph.smartCopy", "datamorph.smartOpen"],
            },
          });
        }
      });
      const from = model.getPositionAt(hints[0].start),
        to = model.getPositionAt(hints[0].end);
      return {
        range: new monaco.Range(
          from.lineNumber,
          from.column,
          to.lineNumber,
          to.column,
        ),
        contents,
      };
    },
  };
  displays.set(editor.getId(), entry);
  refresh();
}

export function detachSmartDisplay(
  editor: monaco.editor.IStandaloneCodeEditor,
) {
  displays.get(editor.getId())?.dispose();
  displays.delete(editor.getId());
}
function registerSmartDisplay() {
  if (registered) return;
  registered = true;
  for (const action of ["Copy", "Open"] as const)
    monaco.editor.registerCommand(
      `datamorph.smart${action}`,
      (_accessor, editorId: string, id: number, index: number) => {
        const entry = displays.get(editorId);
        if (
          !entry ||
          entry.actionId !== id ||
          entry.editor.getModel()?.getVersionId() !== entry.actionVersion
        )
          return;
        const hint = entry.actions[index];
        if (hint?.content === undefined) return;
        if (action === "Copy") void clipboard.copy(hint.content, "已复制");
        else
          useTabStore
            .getState()
            .addTab(
              hint.kind === "embeddedJson"
                ? "expanded.json"
                : "text-preview.txt",
              hint.content,
            );
      },
    );
  monaco.languages.registerHoverProvider(["json", "json5"], {
    provideHover(model, position, token) {
      const candidates = [...displays.values()].filter(
        (entry) => entry.editor.getModel() === model,
      );
      const entry =
        candidates.find((item) => item.editor.hasTextFocus()) || candidates[0];
      return entry?.hover(position, token) ?? null;
    },
  });
  useSettingsStore.subscribe((state, previous) => {
    if (
      state.embeddedJsonDecoderEnabled !==
        previous.embeddedJsonDecoderEnabled ||
      state.colorDecoderEnabled !== previous.colorDecoderEnabled ||
      state.summaryDecoderEnabled !== previous.summaryDecoderEnabled
    )
      displays.forEach((entry) => entry.refresh());
  });
}
