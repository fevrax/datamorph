import { detectDataFormat } from "../utils/dataFormatDetection";
self.onmessage = (event) => {
  const { content, filename, previous, documentId, version } = event.data;
  try {
    self.postMessage({
      documentId,
      version,
      language: detectDataFormat(content, filename, previous),
    });
  } catch {
    self.postMessage({ documentId, version, language: previous || "json" });
  }
};
