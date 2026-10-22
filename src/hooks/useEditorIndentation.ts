import { useCallback, useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useTabStore } from "@/store/useTabStore";

export function useEditorIndentation(
  owner: string,
  ready: boolean,
  getModels: () => editor.ITextModel[],
) {
  const defaultSize = useSettingsStore((s) => s.defaultIndentSize);
  const [indentation, setIndentation] = useState(() => {
    const stored = useTabStore.getState().getTabByKey(owner)?.editorSettings;
    return {
      indentMode: stored?.indentMode ?? "auto",
      indentSize: stored?.indentSize ?? defaultSize,
      insertSpaces: stored?.insertSpaces ?? true,
    };
  });
  const current = useRef({ ...indentation, defaultSize });
  current.current = { ...indentation, defaultSize };
  const models = useRef(getModels);
  models.current = getModels;

  // Resolve again before formatting so a just-pasted document does not use the
  // previous document's options while the debounced detection is still pending.
  const resolve = useCallback((model: editor.ITextModel) => {
    const settings = current.current;
    if (settings.indentMode === "auto")
      model.detectIndentation(true, settings.defaultSize);
    else
      model.updateOptions({
        tabSize: settings.indentSize,
        indentSize: settings.indentSize,
        insertSpaces: settings.insertSpaces,
      });
    const options = model.getOptions();
    // Diff models have independent options; the status bar describes the original.
    if (model === models.current()[0])
      setIndentation((previous) =>
        previous.indentSize === options.tabSize &&
        previous.insertSpaces === options.insertSpaces
          ? previous
          : {
              ...previous,
              indentSize: options.tabSize,
              insertSpaces: options.insertSpaces,
            },
      );
    return options;
  }, []);

  const { indentMode, indentSize, insertSpaces } = indentation;
  const manualSize = indentMode === "manual" ? indentSize : undefined;
  const manualSpaces = indentMode === "manual" ? insertSpaces : undefined;
  useEffect(() => {
    if (!ready) return;
    const timers = new Map<editor.ITextModel, ReturnType<typeof setTimeout>>();
    const subscriptions = models.current().flatMap((model) => {
      resolve(model);
      return [
        model.onDidChangeLanguage(() => resolve(model)),
        model.onDidChangeContent(() => {
          if (current.current.indentMode !== "auto") return;
          clearTimeout(timers.get(model));
          timers.set(
            model,
            setTimeout(() => {
              if (!model.isDisposed()) resolve(model);
            }, 250),
          );
        }),
      ];
    });
    return () => {
      timers.forEach(clearTimeout);
      subscriptions.forEach((subscription) => subscription.dispose());
    };
  }, [
    owner,
    ready,
    indentMode,
    manualSize,
    manualSpaces,
    defaultSize,
    resolve,
  ]);

  useEffect(() => {
    useTabStore.getState().updateEditorSettings(owner, indentation);
  }, [owner, indentation]);

  function updateIndentation(next: typeof indentation) {
    // Formatting can run in the same event as a selection, before React renders.
    current.current = { ...next, defaultSize };
    setIndentation(next);
  }

  return {
    ...indentation,
    resolve,
    setMode: (mode: "auto" | "manual") =>
      updateIndentation({
        indentMode: mode,
        indentSize: current.current.indentSize,
        insertSpaces: current.current.insertSpaces,
      }),
    setSize: (size: number) =>
      updateIndentation({
        indentMode: "manual",
        indentSize: size,
        insertSpaces: true,
      }),
    reset: () =>
      updateIndentation({
        indentMode: "auto",
        indentSize: defaultSize,
        insertSpaces: true,
      }),
  };
}
