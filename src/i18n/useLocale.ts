import { useSyncExternalStore } from "react";

import { getLocale, subscribeLocale } from "./locale";

export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale);
}
