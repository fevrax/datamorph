import { executeFormatTask, type FormatTaskInput } from "./formatTasks";
import { errorDetails } from "@/i18n/diagnostics";

self.onmessage = async (
  event: MessageEvent<{ id: number; input: FormatTaskInput }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      result: await executeFormatTask(event.data.input),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: errorDetails(error),
    });
  }
};
