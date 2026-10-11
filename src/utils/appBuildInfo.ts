import type { AppBuildInfo } from "./appVersion";

/** Describes this artifact; an update check must never replace these values. */
export const APP_BUILD_INFO: AppBuildInfo = Object.freeze(__APP_BUILD_INFO__);
