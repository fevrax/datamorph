import type * as monaco from "monaco-editor";
import { saveEditorView } from "./modelRegistry";
export interface EditorAdapter {
  read(): string;
  apply(text: string): void;
  reveal(line: number, column: number): void;
  saveView(): void;
  destroy(): void;
}
export function createEditorAdapter(
  key: string,
  editor: monaco.editor.IStandaloneCodeEditor,
): EditorAdapter {
  return {
    read: () => editor.getValue(),
    apply(text) {
      const model = editor.getModel();
      if (!model || model.getValue() === text) return;
      editor.pushUndoStop();
      editor.executeEdits("datamorph", [
        { range: model.getFullModelRange(), text, forceMoveMarkers: true },
      ]);
      editor.pushUndoStop();
    },
    reveal(line, column) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column });
      editor.focus();
    },
    saveView: () => saveEditorView(key, editor),
    destroy() {
      saveEditorView(key, editor);
      editor.dispose();
    },
  };
}
