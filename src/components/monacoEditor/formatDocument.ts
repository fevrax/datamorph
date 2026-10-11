import * as monaco from "monaco-editor";
import { EXTRA_FORMAT_LANGUAGES } from "@/utils/dataFormats";
import { cancelJsonTask, runJsonTask } from "@/workers/client";
import toast from "@/utils/toast";

/** Extra formatters participate in Monaco's format action and undo history. */
export function registerFormatProviders() {
  for (const language of EXTRA_FORMAT_LANGUAGES) {
    monaco.languages.registerDocumentFormattingEditProvider(language, {
      async provideDocumentFormattingEdits(model, options, token) {
        if (token.isCancellationRequested) return [];
        const version = model.getVersionId();
        const scope = "format:" + model.uri.toString();
        const request = runJsonTask(scope, {
          action: "format-code",
          content: model.getValue(),
          language,
          indent: options.tabSize,
          insertSpaces: options.insertSpaces,
        });
        const cancellation = token.onCancellationRequested(() =>
          cancelJsonTask(scope),
        );
        try {
          const result = await request;
          if (
            token.isCancellationRequested ||
            model.isDisposed() ||
            model.getVersionId() !== version ||
            model.getLanguageId() !== language ||
            result.content === undefined
          )
            return [];
          return [{ range: model.getFullModelRange(), text: result.content }];
        } catch (error) {
          if ((error as Error).name !== "AbortError")
            toast.error("格式化失败", (error as Error).message);
          return [];
        } finally {
          cancellation.dispose();
        }
      },
    });
  }
}

export async function formatEditorDocument(
  editor: monaco.editor.IStandaloneCodeEditor,
): Promise<void> {
  const model = editor.getModel();
  if (!model || !model.getValue().trim()) return;
  const language = model.getLanguageId();
  // Language services load lazily after a model changes language.
  const deadline = Date.now() + 5000;
  let action = editor.getAction("editor.action.formatDocument");
  while (!action?.isSupported() && Date.now() < deadline) {
    if (
      model.isDisposed() ||
      editor.getModel() !== model ||
      model.getLanguageId() !== language
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 25));
    action = editor.getAction("editor.action.formatDocument");
  }
  if (
    model.isDisposed() ||
    editor.getModel() !== model ||
    model.getLanguageId() !== language
  )
    return;
  if (!action?.isSupported())
    throw new Error(`${language.toUpperCase()} 的格式化服务尚未就绪，请重试`);
  await action.run();
}
