import { executeJsonTask, type JsonTaskInput } from "./jsonTasks";
import { executeProtoTask, type ProtoTaskInput } from "./protoTasks";
self.onmessage = (
  event: MessageEvent<{ id: number; input: JsonTaskInput | ProtoTaskInput }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      result:
        event.data.input.action === "renumber-proto"
          ? executeProtoTask(event.data.input)
          : executeJsonTask(event.data.input),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
