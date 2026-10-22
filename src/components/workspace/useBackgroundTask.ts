import { useContext, useEffect, useRef, useCallback } from "react";
import { ToolContext } from "./ToolContext";
import { runJsonTask, cancelJsonTask } from "@/workers/client";
import type { ConversionInput } from "@/workers/conversion";
import type { JsonTaskInput } from "@/workers/jsonTasks";
import type { ProtoTaskInput } from "@/workers/protoTasks";
export function useBackgroundTask(source: string, channel = "conversion") {
  const key = useContext(ToolContext);
  const scope = `tool:${key}:${channel}`;
  const current = useRef(source);
  current.current = source;
  useEffect(() => () => cancelJsonTask(scope), [scope, source]);
  const run = useCallback(
    async (input: ConversionInput | JsonTaskInput | ProtoTaskInput) => {
      const snapshot = current.current;
      const result = await runJsonTask(scope, input);
      if (current.current !== snapshot)
        throw new DOMException("输入已变化", "AbortError");
      return result;
    },
    [scope],
  );
  return { run, cancel: () => cancelJsonTask(scope) };
}
