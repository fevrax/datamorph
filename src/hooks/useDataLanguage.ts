import { useEffect, useId, useRef, useState } from "react";
import {
  formatFromFilename,
  DATA_FORMATS,
  type DataFormat,
  type LanguageMode,
} from "@/utils/dataFormats";

import {
  DetectionSession,
  type DetectionTicket,
} from "@/utils/detectionRequest";

/** Each request owns a worker; disposing a request also cancels expensive parsing. */
export function useDataLanguage(
  content: string,
  language = "json",
  mode: LanguageMode = "auto",
  filename?: string,
  documentId?: string,
): string {
  const instanceId = useId();
  const session = useRef(new DetectionSession()).current;
  const ticket = session.update(
    documentId || instanceId,
    content,
    mode,
    filename,
  );
  const [detected, setDetected] = useState<string>(
    formatFromFilename(filename) || language,
  );
  const previous = useRef<DataFormat | undefined>(
    DATA_FORMATS.find((f) => f.id === language)?.id,
  );
  const first = useRef(true);
  useEffect(() => {
    if (mode === "manual") {
      first.current = true;
      previous.current = undefined;
      return;
    }
    const hint = formatFromFilename(filename);
    if (hint || !content.trim()) {
      setDetected(hint || "json");
      previous.current = hint;
      first.current = true;
      return;
    }
    let worker: Worker | undefined;
    let active = true;
    const detect = () => {
      worker = new Worker(
        new URL("../workers/formatDetection.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (
        event: MessageEvent<DetectionTicket & { language: DataFormat }>,
      ) => {
        if (!active || !session.accepts(event.data)) return;
        previous.current = event.data.language;
        setDetected(event.data.language);
        worker?.terminate();
      };
      worker.onerror = () => {
        worker?.terminate();
        if (active && session.accepts(ticket))
          setDetected(previous.current || "json");
      };
      worker.postMessage({
        ...ticket,
        content,
        filename,
        previous: previous.current,
      });
    };
    const timer = first.current
      ? undefined
      : setTimeout(detect, content.length > 1_000_000 ? 1000 : 400);
    if (first.current) detect();
    first.current = false;
    return () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [content, mode, filename, session, ticket]);
  return mode === "manual"
    ? language
    : formatFromFilename(filename) || (!content.trim() ? "json" : detected);
}
