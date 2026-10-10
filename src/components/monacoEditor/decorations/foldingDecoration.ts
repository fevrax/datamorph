import * as monaco from "monaco-editor";
import type { RefObject } from "react";
import { indexStructure, type StructureRegion } from "@/workers/structure";
const cache = new WeakMap<
  monaco.editor.ITextModel,
  {
    version: number;
    regions: StructureRegion[];
    worker?: Worker;
    timer?: ReturnType<typeof setTimeout>;
    cleanup?: () => void;
  }
>();
export function updateFoldingDecorations(
  editor: monaco.editor.IStandaloneCodeEditor,
  language: string | undefined,
  ref: RefObject<monaco.editor.IEditorDecorationsCollection | null>,
) {
  const model = editor.getModel();
  if (!model || !["json", "json5"].includes(language || "")) {
    ref.current?.clear();
    return;
  }
  const version = model.getVersionId();
  let entry = cache.get(model);
  const render = (regions: StructureRegion[]) => {
    if (
      editor.getModel() !== model ||
      model.isDisposed() ||
      model.getVersionId() !== version
    )
      return;
    const ranges = editor.getVisibleRanges();
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    for (const region of regions) {
      if (
        region.endLine <= region.startLine ||
        !ranges.some(
          (r) =>
            region.startLine >= r.startLineNumber &&
            region.startLine <= r.endLineNumber,
        )
      )
        continue;
      const collapsed =
        editor.getTopForLineNumber(region.startLine + 1) ===
        editor.getTopForLineNumber(region.endLine + 1);
      if (!collapsed) continue;
      const column = model.getLineMaxColumn(region.startLine);
      decorations.push({
        range: new monaco.Range(
          region.startLine,
          column,
          region.startLine,
          column,
        ),
        options: {
          after: {
            content: `  ${region.type}{${region.count}}`,
            inlineClassName: "json-fold-count",
            cursorStops: monaco.editor.InjectedTextCursorStops.None,
          },
        },
      });
    }
    if (!ref.current) ref.current = editor.createDecorationsCollection();
    ref.current.set(decorations);
  };
  if (entry?.version === version) {
    if (!entry.worker && !entry.timer) render(entry.regions);
    return;
  }
  entry?.worker?.terminate();
  clearTimeout(entry?.timer);
  entry?.cleanup?.();
  entry = { version, regions: [] };
  cache.set(model, entry);
  const current = entry;
  const cleanup = model.onWillDispose(() => {
    clearTimeout(current.timer);
    current.worker?.terminate();
  });
  current.cleanup = () => cleanup.dispose();
  const build = () => {
    current.timer = undefined;
    if (model.isDisposed() || model.getVersionId() !== version) return;
    const worker = new Worker(
      new URL("../../../workers/structure.worker.ts", import.meta.url),
      { type: "module" },
    );
    current.worker = worker;
    worker.onmessage = (event) => {
      worker.terminate();
      cleanup.dispose();
      current.worker = undefined;
      current.regions = event.data.regions;
      render(current.regions);
    };
    worker.onerror = () => {
      worker.terminate();
      cleanup.dispose();
      cache.delete(model);
    };
    worker.postMessage({ text: model.getValue(), version });
  };
  // Visible hints stay responsive; rebuilding the full structure waits for typing to settle.
  if (model.getValueLength() > 1_000_000)
    current.timer = setTimeout(build, 900);
  else build();
}
export function calculateFoldingElementCount(
  _language: string,
  lines: string[],
  startLine: number,
  endLine: number,
): { count: number; type: number } {
  const regions = indexStructure(
    lines.slice(startLine - 2, endLine + 1).join("\n"),
  );
  const root = regions[regions.length - 1];
  return { count: root?.count || 0, type: root?.type === "Object" ? 1 : 0 };
}
