import { execFileSync } from "node:child_process";

function readGitCommit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function isUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
    return false;
  }
  const time = new Date(value);

  return (
    Number.isFinite(time.getTime()) &&
    time.toISOString() ===
      (value.includes(".") ? value : value.replace("Z", ".000Z"))
  );
}

export function readAppBuildInfo(
  env: Record<string, string | undefined>,
  command: "serve" | "build",
  options: { readCommit?: () => string | null; now?: () => Date } = {},
) {
  const version = env.APP_VERSION || null;
  const explicitSha = env.APP_COMMIT_SHA || null;
  const explicitTime = env.APP_BUILD_TIME || null;

  if (
    version !== null &&
    (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
      !version.split(".").map(Number).every(Number.isSafeInteger))
  ) {
    throw new Error(
      "APP_VERSION must be a stable semantic version, e.g. 1.2.3",
    );
  }
  if (explicitSha !== null && !/^[0-9a-f]{40}$/.test(explicitSha)) {
    throw new Error("APP_COMMIT_SHA must be a full lowercase Git commit SHA");
  }
  if (explicitTime !== null && !isUtcTimestamp(explicitTime)) {
    throw new Error("APP_BUILD_TIME must be a valid UTC ISO timestamp");
  }
  const candidateSha = explicitSha ?? (options.readCommit ?? readGitCommit)();
  const commitSha =
    candidateSha && /^[0-9a-f]{40}$/.test(candidateSha) ? candidateSha : null;

  if (version !== null && commitSha === null) {
    throw new Error(
      "A release build requires APP_COMMIT_SHA or a Git checkout",
    );
  }

  return {
    version,
    commitSha,
    builtAt:
      explicitTime ??
      (command === "build"
        ? (options.now ?? (() => new Date()))().toISOString()
        : null),
  };
}
