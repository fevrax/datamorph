import * as monaco from "monaco-editor";
const models = new Map<string, monaco.editor.ITextModel>();
const views = new Map<string, monaco.editor.ICodeEditorViewState>();
export function getDocumentModel(
  key: string,
  content: string,
  language = "json",
) {
  let model = models.get(key);
  if (!model || model.isDisposed()) {
    model = monaco.editor.createModel(
      content,
      language,
      monaco.Uri.parse("json-tools://document/" + encodeURIComponent(key)),
    );
    models.set(key, model);
  } else {
    if (model.getValue() !== content) {
      model.pushStackElement();
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: content }],
        () => null,
      );
      model.pushStackElement();
    }
    if (model.getLanguageId() !== language)
      monaco.editor.setModelLanguage(model, language);
  }
  return model;
}
export function saveEditorView(
  key: string,
  editor: monaco.editor.IStandaloneCodeEditor,
) {
  const state = editor.saveViewState();
  if (state) views.set(key, state);
}
export function restoreEditorView(
  key: string,
  editor: monaco.editor.IStandaloneCodeEditor,
) {
  const state = views.get(key);
  if (state) editor.restoreViewState(state);
}
export function releaseDocumentModels(key: string) {
  for (const [id, model] of models) {
    if (id === key || id.startsWith(key + "::")) {
      model.dispose();
      models.delete(id);
      views.delete(id);
    }
  }
}
export const modelRegistryStats = () => ({
  models: models.size,
  views: views.size,
});
if (typeof window !== "undefined")
  window.addEventListener("json-tools:close-model", (event) => {
    const key = (event as CustomEvent<string>).detail;
    setTimeout(() => releaseDocumentModels(key), 0);
  });
