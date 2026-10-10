import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTabStore, type TabKind } from "./useTabStore";
export function useTabMetadata() {
  const values = useTabStore(
    useShallow((state) =>
      state.tabs.map((tab) =>
        JSON.stringify([
          tab.key,
          tab.title,
          tab.kind,
          tab.extraData?.url || "",
        ]),
      ),
    ),
  );
  return useMemo(
    () =>
      values.map((value) => {
        const [key, title, kind, url] = JSON.parse(value) as [
          string,
          string,
          TabKind,
          string,
        ];
        return { key, title, kind, extraData: { url } };
      }),
    [values],
  );
}
