import {
  LATEST_RELEASE_API_URL,
  parseStableVersion,
} from "../utils/appVersion";

export interface LatestReleaseInfo {
  readonly version: string;
  readonly checkedAt: number;
}

type ReleaseCheckErrorKind =
  | "offline"
  | "timeout"
  | "rate-limit"
  | "not-found"
  | "invalid-response"
  | "network"
  | "http";

export class ReleaseCheckError extends Error {
  constructor(
    public readonly kind: ReleaseCheckErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ReleaseCheckError";
  }
}

interface PendingCheck {
  controller: AbortController;
  promise: Promise<LatestReleaseInfo>;
  subscribers: number;
}

export function createReleaseChecker(
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
    isOnline?: () => boolean;
    timeoutMs?: number;
    cacheTtlMs?: number;
  } = {},
) {
  const now = options.now ?? Date.now;
  const isOnline =
    options.isOnline ??
    (() => typeof navigator === "undefined" || navigator.onLine !== false);
  let cache: LatestReleaseInfo | undefined;
  let pending: PendingCheck | undefined;

  async function request(
    controller: AbortController,
  ): Promise<LatestReleaseInfo> {
    const { signal } = controller;
    let timedOut = false;
    let onAbort!: () => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () =>
        reject(new DOMException("Request cancelled", "AbortError"));
      signal.addEventListener("abort", onAbort, { once: true });
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? 10_000);

    try {
      const load = async () => {
        const response = await (options.fetcher ?? fetch)(
          LATEST_RELEASE_API_URL,
          {
            signal,
            credentials: "omit",
            cache: "no-store",
            headers: { Accept: "application/vnd.github+json" },
          },
        );

        if (
          response.status === 429 ||
          (response.status === 403 &&
            (response.headers.get("x-ratelimit-remaining") === "0" ||
              response.headers.has("retry-after")))
        ) {
          throw new ReleaseCheckError(
            "rate-limit",
            "GitHub 请求过于频繁，请稍后重试",
          );
        }
        if (response.status === 404) {
          throw new ReleaseCheckError(
            "not-found",
            "未找到可用的 GitHub 正式发布",
          );
        }
        if (!response.ok) {
          throw new ReleaseCheckError(
            "http",
            "GitHub 暂时无法提供发布信息，请稍后重试",
          );
        }
        let data: unknown;

        try {
          data = await response.json();
        } catch {
          throw new ReleaseCheckError(
            "invalid-response",
            "GitHub 返回的发布信息无效",
          );
        }
        const release = data as Record<string, unknown> | null;
        const tag =
          release && typeof release.tag_name === "string"
            ? release.tag_name
            : "";
        const version = tag.replace(/^v/, "");

        if (
          !release ||
          tag !== `v${version}` ||
          release.draft !== false ||
          release.prerelease !== false ||
          !parseStableVersion(version)
        ) {
          throw new ReleaseCheckError(
            "invalid-response",
            "GitHub 返回的正式版本信息无效",
          );
        }
        signal.throwIfAborted();

        return { version, checkedAt: now() };
      };
      const result = await Promise.race([load(), aborted]);

      signal.throwIfAborted();
      cache = result;

      return result;
    } catch (error) {
      if (timedOut) {
        throw new ReleaseCheckError("timeout", "检查更新超时，请稍后重试");
      }
      if (signal.aborted)
        throw new DOMException("Request cancelled", "AbortError");
      if (error instanceof ReleaseCheckError) throw error;
      throw new ReleaseCheckError(
        "network",
        "无法连接 GitHub，请检查网络后重试",
      );
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
  }

  function subscribe(check: PendingCheck, signal?: AbortSignal) {
    check.subscribers++;

    return new Promise<LatestReleaseInfo>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        check.subscribers--;
        if (check.subscribers === 0 && pending === check) {
          pending = undefined;
          check.controller.abort();
        }

        return true;
      };
      const onAbort = () => {
        if (finish())
          reject(new DOMException("Request cancelled", "AbortError"));
      };

      signal?.addEventListener("abort", onAbort, { once: true });
      check.promise.then(
        (result) => {
          if (finish()) resolve(result);
        },
        (error: unknown) => {
          if (finish()) reject(error);
        },
      );
    });
  }

  return {
    check(signal?: AbortSignal): Promise<LatestReleaseInfo> {
      if (signal?.aborted) {
        return Promise.reject(
          new DOMException("Request cancelled", "AbortError"),
        );
      }
      if (
        cache &&
        now() - cache.checkedAt < (options.cacheTtlMs ?? 5 * 60_000)
      ) {
        return Promise.resolve(cache);
      }
      if (!isOnline()) {
        return Promise.reject(
          new ReleaseCheckError("offline", "当前处于离线状态，请联网后重试"),
        );
      }
      if (!pending) {
        const controller = new AbortController();
        const check: PendingCheck = {
          controller,
          subscribers: 0,
          promise: request(controller).finally(() => {
            if (pending === check) pending = undefined;
          }),
        };

        pending = check;
      }

      return subscribe(pending, signal);
    },
  };
}

export const releaseChecker = createReleaseChecker();
