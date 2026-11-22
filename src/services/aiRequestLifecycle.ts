import type { StaticMessage } from "@/i18n";
import { messageError } from "@/i18n/diagnostics";
import { APIConnectionTimeoutError } from "openai/error";

export interface AIRequestOptions {
  signal?: AbortSignal;
  /** Total request deadline, including stream consumption. Defaults to SDK's 10 minutes. */
  timeoutMs?: number;
}

export interface AICompletionCallbacks {
  onStart?: () => void;
  onProcessing?: (step: StaticMessage) => void;
  onChunk?: (chunk: string, accumulated: string) => void;
  onComplete?: (final: string) => void;
  onError?: (error: Error) => void;
}

export function normalizeAIError(error: unknown): Error {
  const result = error instanceof Error ? error : new Error(String(error));

  if (
    result instanceof APIConnectionTimeoutError ||
    result.name === "APIConnectionTimeoutError" ||
    result.name === "TimeoutError"
  ) {
    return Object.assign(messageError("AI 请求超时，请稍后重试。"), {
      name: "TimeoutError",
    });
  }

  return result;
}

export async function runAICompletion(
  operation: (
    request: AIRequestLifecycle,
    callbacks: AICompletionCallbacks,
  ) => Promise<string>,
  callbacks: AICompletionCallbacks = {},
  options: AIRequestOptions = {},
): Promise<boolean> {
  const request = new AIRequestLifecycle(options);
  const guarded: AICompletionCallbacks = {
    onProcessing: (step) => {
      if (request.active) callbacks.onProcessing?.(step);
    },
    onChunk: (chunk, accumulated) => {
      if (request.active) callbacks.onChunk?.(chunk, accumulated);
    },
  };
  let completed = false;

  try {
    request.check();
    callbacks.onStart?.();
    request.check();
    const result = await request.wait(operation(request, guarded));

    // The SDK swallows AbortError during iteration; a resolved stream can still be cancelled.
    request.check();
    callbacks.onComplete?.(result);
    guarded.onProcessing?.("处理完成");
    completed = true;

    return true;
  } catch (error) {
    if (!request.cancelled)
      callbacks.onError?.(
        normalizeAIError(
          request.signal.aborted ? request.signal.reason : error,
        ),
      );

    return false;
  } finally {
    request.dispose(!completed);
  }
}

export class AIRequestLifecycle {
  private controller = new AbortController();
  private disposed = false;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private abortHandlers = new Set<() => void>();
  private external?: AbortSignal;
  private cancel = () =>
    this.controller.abort(
      Object.assign(messageError("已取消生成"), { name: "AbortError" }),
    );

  constructor(options: AIRequestOptions) {
    this.external = options.signal;
    this.signal.addEventListener("abort", this.abortTransport);
    this.external?.addEventListener("abort", this.cancel, { once: true });
    if (this.external?.aborted) this.cancel();
    if (!this.signal.aborted) {
      this.timeout = setTimeout(
        () =>
          this.controller.abort(
            Object.assign(messageError("AI 请求超时，请稍后重试。"), {
              name: "TimeoutError",
            }),
          ),
        options.timeoutMs ?? 600_000,
      );
    }
  }

  get signal() {
    return this.controller.signal;
  }
  get active() {
    return !this.disposed && !this.signal.aborted;
  }
  get cancelled() {
    return this.signal.aborted && this.signal.reason?.name === "AbortError";
  }
  check() {
    if (this.signal.aborted) throw this.signal.reason;
  }

  private abortTransport = () => {
    for (const abort of this.abortHandlers) {
      try {
        abort();
      } catch {
        /* A provider's abort failure must not block local cancellation. */
      }
    }
    this.abortHandlers.clear();
  };

  onAbort(abort: () => void) {
    if (!this.active) {
      try {
        abort();
      } catch {
        /* Late transports still get a best-effort abort. */
      }
    } else this.abortHandlers.add(abort);
  }

  async wait<T>(promise: PromiseLike<T>): Promise<T> {
    // Always observe the provider promise, including rejection after cancellation.
    const observed = Promise.resolve(promise);
    let abort: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(this.signal.reason);
      this.signal.addEventListener("abort", abort, { once: true });
      if (this.signal.aborted) abort();
    });

    try {
      return await Promise.race([observed, cancelled]);
    } finally {
      this.signal.removeEventListener("abort", abort);
    }
  }

  dispose(abortTransport = true) {
    this.disposed = true;
    clearTimeout(this.timeout);
    this.external?.removeEventListener("abort", this.cancel);
    if (abortTransport) this.abortTransport();
    this.abortHandlers.clear();
    this.signal.removeEventListener("abort", this.abortTransport);
  }
}

/** A component-owned request slot. Clearing before abort prevents reentrant stale callbacks. */
export class AIRequestSlot {
  private current: AbortController | null = null;
  start() {
    this.cancel();
    const controller = new AbortController();

    this.current = controller;

    return controller;
  }
  get busy() {
    return this.current !== null;
  }
  owns(controller: AbortController) {
    return this.current === controller && !controller.signal.aborted;
  }
  finish(controller: AbortController) {
    if (this.current === controller) this.current = null;
  }
  cancel() {
    const previous = this.current;

    this.current = null;
    previous?.abort();
  }
}

interface AIStream
  extends AsyncIterable<{
    choices: { delta?: { content?: string | null } }[];
  }> {
  controller: AbortController;
}

export async function collectOpenAIStream(
  request: AIRequestLifecycle,
  callbacks: AICompletionCallbacks,
  create: () => PromiseLike<AIStream>,
): Promise<string> {
  request.check();
  const stream = await request.wait(
    Promise.resolve(create()).then((stream) => {
      request.onAbort(() => stream.controller.abort());

      return stream;
    }),
  );

  callbacks.onProcessing?.("AI 正在接收数据...");
  let accumulated = "";

  for await (const chunk of stream) {
    request.check();
    const content = chunk.choices[0]?.delta?.content || "";

    if (content) {
      accumulated += content;
      callbacks.onChunk?.(content, accumulated);
    }
  }
  request.check();

  return accumulated;
}

export async function collectUtoolsStream(
  request: AIRequestLifecycle,
  callbacks: AICompletionCallbacks,
  create: (
    onChunk: (chunk: { content?: string; reasoning_content?: string }) => void,
  ) => PromiseLike<unknown> & { abort?: () => void },
): Promise<string> {
  request.check();
  let accumulated = "";
  const promise = create((chunk) => {
    if (!request.active) return;
    if (chunk.content) {
      accumulated += chunk.content;
      callbacks.onChunk?.(chunk.content, accumulated);
    }
    if (chunk.reasoning_content) callbacks.onProcessing?.("AI 正在推理中...");
  });

  request.onAbort(() => promise.abort?.());
  await request.wait(promise);
  request.check();

  return accumulated;
}

let requestSequence = 0;

/** Serializable so conversation snapshots remain compatible with IndexedDB. */
export function createAIRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `ai-${Date.now()}-${++requestSequence}`
  );
}
