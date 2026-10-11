import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { initMonacoGlobally } from "@/components/monacoEditor/decorations/decorationInit";
import { useDataLanguage } from "@/hooks/useDataLanguage";
import type { LanguageMode } from "@/utils/dataFormats";
import { Spinner } from "@/components/ui";

export default function HistoryDiffPreview({
  original,
  modified,
  language,
  languageMode = "manual",
  filename,
  theme,
}: {
  original: string;
  modified: string;
  language: string;
  languageMode?: LanguageMode;
  filename?: string;
  theme: string;
}) {
  const originalLanguage = useDataLanguage(
    original,
    language,
    languageMode,
    filename,
  );
  const modifiedLanguage = useDataLanguage(
    modified,
    language,
    languageMode,
    filename,
  );
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const models = useRef<monaco.editor.IDiffEditorModel | null>(null);
  const latest = useRef({
    original,
    modified,
    originalLanguage,
    modifiedLanguage,
    theme,
  });
  latest.current = {
    original,
    modified,
    originalLanguage,
    modifiedLanguage,
    theme,
  };
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let disposed = false;
    void initMonacoGlobally()
      .then(() => {
        if (disposed || !host.current) return;
        const values = latest.current;
        const instance = monaco.editor.createDiffEditor(host.current, {
          automaticLayout: true,
          theme: values.theme,
          readOnly: true,
          domReadOnly: true,
          originalEditable: false,
          originalAriaLabel: "历史版本内容，只读",
          modifiedAriaLabel: "当前文档内容，只读",
          renderSideBySide: true,
          useInlineViewWhenSpaceIsLimited: true,
          renderSideBySideInlineBreakpoint: 520,
          enableSplitViewResizing: true,
          renderOverviewRuler: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbersMinChars: 3,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          ignoreTrimWhitespace: false,
          maxComputationTime: 3000,
          renderMarginRevertIcon: false,
          renderGutterMenu: false,
          links: false,
          stickyScroll: { enabled: false },
        });
        const pair = {
          original: monaco.editor.createModel(
            values.original,
            values.originalLanguage,
          ),
          modified: monaco.editor.createModel(
            values.modified,
            values.modifiedLanguage,
          ),
        };
        editor.current = instance;
        models.current = pair;
        instance.setModel(pair);
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      editor.current?.dispose();
      models.current?.original.dispose();
      models.current?.modified.dispose();
      editor.current = null;
      models.current = null;
    };
  }, []);
  useEffect(() => {
    const pair = models.current;
    if (!pair) return;
    if (pair.original.getValue() !== original) pair.original.setValue(original);
    if (pair.modified.getValue() !== modified) pair.modified.setValue(modified);
  }, [original, modified]);
  useEffect(() => {
    monaco.editor.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (!models.current) return;
    monaco.editor.setModelLanguage(models.current.original, originalLanguage);
    monaco.editor.setModelLanguage(models.current.modified, modifiedLanguage);
  }, [originalLanguage, modifiedLanguage, status]);
  return (
    <div className="history-diff-preview">
      <div className="relative min-h-0 flex-1">
        <div
          ref={host}
          className="h-full w-full"
          role="region"
          aria-label="历史与当前内容差异"
        />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            {status === "loading" ? (
              <Spinner label="正在准备比较…" />
            ) : (
              <p role="alert">无法加载比较，请切换到内容预览。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
