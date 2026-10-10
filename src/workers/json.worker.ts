import { executeJsonTask, type JsonTaskInput } from "./jsonTasks";
self.onmessage = (
  event: MessageEvent<{ id: number; input: JsonTaskInput }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      result: executeJsonTask(event.data.input),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
