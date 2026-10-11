import type { FormatTaskInput } from "./formatTasks";
import type { ConversionInput } from "./conversion";
import type { JsonTaskInput } from "./jsonTasks";
export type TaskResult = {
  data?: unknown;
  matchCount?: number;
  buffer?: ArrayBuffer;
  content?: string;
  error?: { message: string; line: number; column: number; detail?: string };
};
let nextId = 0;
const subscribers = new Set<() => void>();
export const subscribeTasks = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};
export const getPendingScopes = () => [...pending.keys(), ...external.keys()];
function notifyTasks() {
  subscribers.forEach((callback) => callback());
}
const idle: Record<string, Worker[]> = {
  document: [],
  conversion: [],
  format: [],
};

const pending = new Map<
  string,
  { worker: Worker; reject: (error: Error) => void }
>();
export function cancelJsonTask(scope: string) {
  const request = external.get(scope);
  if (request) {
    request.abort();
    external.delete(scope);
    notifyTasks();
  }
  const job = pending.get(scope);
  if (job) {
    job.worker.terminate();
    job.reject(new DOMException("操作已取消", "AbortError"));
    pending.delete(scope);
    notifyTasks();
  }
}
export function runJsonTask(
  scope: string,
  input: JsonTaskInput | ConversionInput | FormatTaskInput,
): Promise<TaskResult> {
  cancelJsonTask(scope);
  return new Promise((resolve, reject) => {
    const kind =
      input.action === "format-code"
        ? "format"
        : ["convert", "type", "keys", "encode", "decode", "export"].includes(
              input.action,
            )
          ? "conversion"
          : "document";
    const worker =
      idle[kind].pop() ||
      (kind === "format"
        ? new Worker(new URL("./format.worker.ts", import.meta.url), {
            type: "module",
          })
        : kind === "conversion"
          ? new Worker(new URL("./conversion.worker.ts", import.meta.url), {
              type: "module",
            })
          : new Worker(new URL("./json.worker.ts", import.meta.url), {
              type: "module",
            }));
    const id = ++nextId;
    pending.set(scope, { worker, reject });
    notifyTasks();
    const cleanup = (reuse = true) => {
      worker.onmessage = null;
      worker.onerror = null;
      if (reuse && idle[kind].length < 2) idle[kind].push(worker);
      else worker.terminate();
      if (pending.get(scope)?.worker === worker) pending.delete(scope);
      notifyTasks();
    };
    worker.onmessage = (event) => {
      if (event.data.id !== id) return;
      cleanup();
      if (event.data.error)
        reject(Object.assign(new Error(event.data.error), event.data.details));
      else resolve(event.data.result);
    };
    worker.onerror = (event) => {
      cleanup(false);
      reject(new Error(event.message));
    };
    worker.postMessage({ id, input });
  });
}

const external = new Map<string, AbortController>();
export function registerExternalTask(
  scope: string,
  controller: AbortController,
) {
  cancelJsonTask(scope);
  external.set(scope, controller);
  notifyTasks();
  return () => {
    if (external.get(scope) === controller) {
      external.delete(scope);
      notifyTasks();
    }
  };
}
