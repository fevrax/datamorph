import { indexStructure } from "./structure";
self.onmessage = (event: MessageEvent<{ text: string; version: number }>) =>
  self.postMessage({
    version: event.data.version,
    regions: indexStructure(event.data.text),
  });
