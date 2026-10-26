import { SmartDocument, type SmartFlags } from "./smartDisplay";
import { applyTextChanges } from "../components/monacoEditor/textChanges";
import type { TextChange } from "../store/useTabStore";

export type SmartRequest =
  | { type: "sync"; text: string; version: number }
  | { type: "change"; changes: TextChange[]; version: number }
  | {
      type: "visible";
      id: number;
      version: number;
      flags: SmartFlags;
      ranges: Array<{ start: number; end: number }>;
      collapsedLines: Array<{ start: number; end: number }>;
    }
  | {
      type: "hover";
      id: number;
      version: number;
      flags: SmartFlags;
      offset: number;
    };

let document = new SmartDocument("");
let version = 0;
self.onmessage = (event: MessageEvent<SmartRequest>) => {
  const request = event.data;
  if (request.type === "sync") {
    document = new SmartDocument(request.text);
    version = request.version;
  } else if (request.type === "change") {
    document.update(applyTextChanges(document.text, request.changes));
    version = request.version;
  } else {
    if (request.version !== version) return;
    const hints =
      request.type === "visible"
        ? document.visible(
            request.ranges,
            request.flags,
            request.collapsedLines,
          )
        : document.hover(request.offset, request.flags);
    self.postMessage({
      type: request.type,
      id: request.id,
      version,
      hints,
      limited: document.getIndex().limited,
    });
  }
};
