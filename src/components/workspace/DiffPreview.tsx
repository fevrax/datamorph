import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
export function DiffPreview({
  original,
  modified,
}: {
  original: string;
  modified: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const left = monaco.editor.createModel(original, "json"),
      right = monaco.editor.createModel(modified, "json");
    const diff = monaco.editor.createDiffEditor(host.current, {
      automaticLayout: true,
      readOnly: true,
      originalEditable: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 12,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
    });
    diff.setModel({ original: left, modified: right });
    editor.current = diff;
    return () => {
      diff.dispose();
      left.dispose();
      right.dispose();
      editor.current = null;
    };
  }, []);
  useEffect(() => {
    const model = editor.current?.getModel();
    model?.original.setValue(original);
    model?.modified.setValue(modified);
  }, [original, modified]);
  return (
    <div
      className="h-72 overflow-hidden rounded-md border"
      ref={host}
      aria-label="替换前后差异"
    />
  );
}
