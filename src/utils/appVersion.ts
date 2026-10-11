export interface AppBuildInfo {
  readonly version: string | null;
  readonly commitSha: string | null;
  readonly builtAt: string | null;
}

export const APP_REPOSITORY = "fevrax/datamorph";
export const REPOSITORY_URL = `https://github.com/${APP_REPOSITORY}`;
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${APP_REPOSITORY}/releases/latest`;

/** Only stable semantic versions are published by the current release workflow. */
export function parseStableVersion(version: string): number[] | null {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    return null;
  }
  const parts = version.split(".").map(Number);

  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function releaseUrl(version: string): string {
  return `${RELEASES_URL}/tag/v${version}`;
}

export type ReleaseComparison = "development" | "newer" | "current" | "ahead";

export function compareReleaseVersions(
  current: string | null,
  latest: string,
): ReleaseComparison {
  const right = parseStableVersion(latest);
  const left = current === null ? null : parseStableVersion(current);

  if (!right || (current !== null && !left)) {
    throw new Error("Invalid stable release version");
  }
  if (!left) return "development";
  for (let index = 0; index < 3; index++) {
    if (left[index] < right[index]) return "newer";
    if (left[index] > right[index]) return "ahead";
  }

  return "current";
}
