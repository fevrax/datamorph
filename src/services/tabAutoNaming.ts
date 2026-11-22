import { useSyncExternalStore } from "react";

import { getLocale } from "@/i18n/locale";
import { useOpenAIConfigStore } from "@/store/useOpenAIConfigStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { isTabStoreRemoteSync, useTabStore } from "@/store/useTabStore";

import { OpenAIService } from "./openAIService";
import {
  AUTO_TAB_NAME_TIMEOUT_MS,
  TabAutoNamingController,
  buildAutoTabNamingMessages,
  sanitizeAutoTabTitle,
  type AutoTabNamingInput,
} from "./tabAutoNamingCore";

export * from "./tabAutoNamingCore";

export function canUseCurrentAIRoute(): boolean {
  const state = useOpenAIConfigStore.getState();

  switch (state.routeType) {
    case "default":
      return (
        typeof window !== "undefined" &&
        /^https?:$/.test(window.location.protocol)
      );
    case "utools":
      return (
        state.routeEnabled.utools &&
        typeof window !== "undefined" &&
        "utools" in window
      );
    case "ssooai":
      return (
        state.routeEnabled.ssooai &&
        Boolean(state.ssooaiRoute.apiKey && state.ssooaiRoute.proxyUrl)
      );
    case "custom":
      return (
        state.routeEnabled.custom &&
        Boolean(state.customRoute.apiKey && state.customRoute.proxyUrl)
      );
    default:
      return false;
  }
}

export async function generateAutoTabTitle(
  input: AutoTabNamingInput,
): Promise<string | null> {
  if (input.signal.aborted || !canUseCurrentAIRoute()) return null;

  const service = OpenAIService.createInstance({ silent: true });
  const response = await service.chat({
    messages: buildAutoTabNamingMessages(
      input.content,
      input.language,
      input.locale,
    ),
    temperature: 0.2,
    signal: input.signal,
    timeoutMs: AUTO_TAB_NAME_TIMEOUT_MS,
    silent: true,
  });

  if (input.signal.aborted) return null;
  const raw = response?.choices?.[0]?.message?.content;
  return typeof raw === "string" ? sanitizeAutoTabTitle(raw) : null;
}

export const tabAutoNamingController = new TabAutoNamingController({
  isEnabled: () => useSettingsStore.getState().aiAutoTabNamingEnabled,
  isHydrated: () => useTabStore.getState().hydrated,
  isRemoteSync: isTabStoreRemoteSync,
  getTab: (key) => useTabStore.getState().getTabByKey(key),
  getActiveTab: () => useTabStore.getState().activeTab(),
  getLocale,
  applyTitle: (key, title, expectedRevision) =>
    useTabStore.getState().applyAutoTabTitle(key, title, expectedRevision),
  generateTitle: generateAutoTabTitle,
});

export function startTabAutoNaming(): () => void {
  const unsubscribeTabs = useTabStore.subscribe((state, previous) => {
    tabAutoNamingController.handleTabStoreChange(state, previous);
  });

  const unsubscribeSettings = useSettingsStore.subscribe(
    (state) => state.aiAutoTabNamingEnabled,
    (enabled, previousEnabled) => {
      tabAutoNamingController.handleSettingsChange(enabled, previousEnabled);
    },
  );

  const unsubscribeAIConfig = useOpenAIConfigStore.subscribe(
    (state) =>
      [
        state.routeType,
        state.defaultRoute.model,
        state.utoolsRoute.model,
        state.ssooaiRoute.apiKey,
        state.ssooaiRoute.proxyUrl,
        state.ssooaiRoute.model,
        state.customRoute.apiKey,
        state.customRoute.proxyUrl,
        state.customRoute.model,
        state.routeEnabled.utools,
        state.routeEnabled.ssooai,
        state.routeEnabled.custom,
      ].join("\0"),
    () => {
      tabAutoNamingController.handleAIConfigChange();
    },
  );

  return () => {
    unsubscribeTabs();
    unsubscribeSettings();
    unsubscribeAIConfig();
    tabAutoNamingController.cancelAll();
  };
}

export function useNamingTabKeys(): ReadonlySet<string> {
  return useSyncExternalStore(
    tabAutoNamingController.subscribe,
    tabAutoNamingController.getNamingTabs,
    tabAutoNamingController.getNamingTabs,
  );
}
