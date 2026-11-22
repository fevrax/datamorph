import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTabStore, type TabItem } from "./useTabStore";
import { t } from "@/i18n";
import { useLocale } from "@/i18n/useLocale";
import { isDefaultDocumentName } from "@/utils/dataFormats";
import { useToolboxStore } from "./useToolboxStore";

export function getTabDisplayTitle(tab: TabItem): string {
  if (tab.kind === "toolbox") return t("工具箱");
  if (tab.kind === "tool") {
    const tool = useToolboxStore
      .getState()
      .tools.find(({ id }) => id === tab.toolId);
    return tool ? t(tool.name) : tab.title;
  }
  if (!tab.editorSettings.filename && isDefaultDocumentName(tab.title))
    return t("未命名");
  return tab.title;
}

export function useTabMetadata() {
  useLocale();
  const values = useTabStore(
    useShallow((state) =>
      state.tabs.map((tab) =>
        JSON.stringify([
          tab.key,
          getTabDisplayTitle(tab),
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
          TabItem["kind"],
          string,
        ];
        return { key, title, kind, extraData: { url } };
      }),
    [values],
  );
}
