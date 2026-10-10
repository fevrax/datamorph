import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

export default function ReadOnlyMonacoEditor({
  value,
  theme,
  ariaLabel,
  language = "json",
}: {
  value: string;
  theme: string;
  ariaLabel: string;
  language?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const model = useRef<monaco.editor.ITextModel | null>(null);
  const latest = useRef({ value, theme, language });
  latest.current = { value, theme, language };

  useEffect(() => {
    if (!host.current) return;
    let disposed = false;

    loader.config({ monaco });
    void loader.init().then(() => {
      if (disposed || !host.current) return;
      model.current = monaco.editor.createModel(
        latest.current.value,
        latest.current.language,
      );
      editor.current = monaco.editor.create(host.current, {
        model: model.current,
        theme: latest.current.theme,
        ariaLabel,
        readOnly: true,
        domReadOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        lineNumbersMinChars: 3,
        folding: true,
        glyphMargin: false,
        lineDecorationsWidth: 8,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        renderLineHighlight: "none",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingIndent: "indent",
        fontSize: 12,
        tabSize: 2,
        padding: { top: 12, bottom: 12 },
        contextmenu: true,
        links: false,
        stickyScroll: { enabled: false },
      });
    });

    return () => {
      disposed = true;
      editor.current?.dispose();
      model.current?.dispose();
      editor.current = null;
      model.current = null;
    };
  }, []);

  useEffect(() => {
    if (model.current && model.current.getValue() !== value) {
      model.current.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    editor.current?.updateOptions({ theme });
  }, [theme]);

  useEffect(() => {
    if (model.current) monaco.editor.setModelLanguage(model.current, language);
  }, [language]);

  return (
    <div
      ref={host}
      role="region"
      aria-label={ariaLabel}
      data-value={value}
      className="h-full min-h-0 w-full"
    />
  );
}
