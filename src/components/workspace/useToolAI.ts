import { useContext, useEffect, useCallback } from "react";
import { ToolContext } from "./ToolContext";
import { openAIService } from "@/services/openAIService";
import { registerExternalTask, cancelJsonTask } from "@/workers/client";
export function useToolAI(source: string) {
  const key = useContext(ToolContext);
  const scope = `tool:${key}:ai`;
  useEffect(() => () => cancelJsonTask(scope), [source, scope]);
  const run = useCallback(
    async (...args: Parameters<typeof openAIService.createChatCompletion>) => {
      const controller = new AbortController();
      const complete = registerExternalTask(scope, controller);
      try {
        return await openAIService.createChatCompletion(args[0], args[1], {
          ...args[2],
          signal: controller.signal,
        });
      } finally {
        complete();
      }
    },
    [scope],
  );
  return { run };
}
