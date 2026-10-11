import { executeFormatTask, type FormatTaskInput } from "./formatTasks";

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
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
