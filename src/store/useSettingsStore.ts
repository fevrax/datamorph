import toast from "@/utils/toast";
// useSettingsStore.ts
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";

import { StorageManager } from "@/lib/storage/StorageManager";

const storageManager = new StorageManager();

// 定义聊天窗口样式类型
export type ChatStyle = "bubble" | "document";

// 定义字体大小类型
export type FontSize = "small" | "medium" | "large";

// 定义 Monaco 编辑器 CDN 类型
export type MonacoEditorCDN = "local" | "cdn";

// 全局设置状态接口
export interface SettingsState {
  // 侧边栏展开状态
  expandSidebar: boolean;
  // Monaco 编辑器 CDN 配置
  monacoEditorCDN: MonacoEditorCDN;
  // 聊天窗口样式
  chatStyle: ChatStyle;
  // 字体大小设置
  fontSize: FontSize;
  // 解码器设置
  timestampDecoderEnabled: boolean;
  base64DecoderEnabled: boolean;
  unicodeDecoderEnabled: boolean;
  urlDecoderEnabled: boolean;
  imageDecoderEnabled: boolean;
  // 编辑器默认设置
  defaultIndentSize: number;
  // 快捷键设置
  newTabShortcut: string;
  closeTabShortcut: string;
  // 本地数据持久化开关
  persistentDataEnabled: boolean;

  // Actions
  setExpandSidebar: (value: boolean) => void;
  setMonacoEditorCDN: (value: MonacoEditorCDN) => void;
  setChatStyle: (value: ChatStyle) => void;
  setFontSize: (value: FontSize) => void;
  setTimestampDecoderEnabled: (value: boolean) => void;
  setBase64DecoderEnabled: (value: boolean) => void;
  setUnicodeDecoderEnabled: (value: boolean) => void;
  setImageDecoderEnabled: (value: boolean) => void;
  setUrlDecoderEnabled: (value: boolean) => void;
  setDefaultIndentSize: (value: number) => void;
  setNewTabShortcut: (value: string) => void;
  setCloseTabShortcut: (value: string) => void;
  setPersistentDataEnabled: (value: boolean) => void;
  setSettings: (settings: Partial<SettingsState>) => void;
  syncSettingsStore: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    devtools(
      (set) => ({
        // 初始状态
        expandSidebar: true,
        monacoEditorCDN: "local",
        chatStyle: "bubble",
        fontSize: "medium",
        timestampDecoderEnabled: true,
        base64DecoderEnabled: true,
        unicodeDecoderEnabled: true,
        urlDecoderEnabled: true,
        imageDecoderEnabled: true,
        defaultIndentSize: 4,
        newTabShortcut: "Ctrl+Shift+T",
        closeTabShortcut: "Ctrl+Shift+W",
        persistentDataEnabled: true,

        // Actions 实现
        setExpandSidebar: (value: boolean) => set({ expandSidebar: value }),
        setMonacoEditorCDN: (value: MonacoEditorCDN) =>
          set({ monacoEditorCDN: value }),
        setChatStyle: (value: ChatStyle) => set({ chatStyle: value }),
        setFontSize: (value: FontSize) => set({ fontSize: value }),
        setTimestampDecoderEnabled: (value: boolean) =>
          set({ timestampDecoderEnabled: value }),
        setBase64DecoderEnabled: (value: boolean) =>
          set({ base64DecoderEnabled: value }),
        setUnicodeDecoderEnabled: (value: boolean) =>
          set({ unicodeDecoderEnabled: value }),
        setImageDecoderEnabled: (value: boolean) =>
          set({ imageDecoderEnabled: value }),
        setUrlDecoderEnabled: (value: boolean) =>
          set({ urlDecoderEnabled: value }),
        setDefaultIndentSize: (value: number) =>
          set({ defaultIndentSize: value }),
        setNewTabShortcut: (value: string) => set({ newTabShortcut: value }),
        setCloseTabShortcut: (value: string) =>
          set({ closeTabShortcut: value }),
        setPersistentDataEnabled: (value: boolean) =>
          set({ persistentDataEnabled: value }),
        setSettings: (settings: Partial<SettingsState>) => set(settings),
        // 从存储同步设置数据
        syncSettingsStore: async () => {
          const settings = await storageManager.get<SettingsState>(DB_SETTINGS);

          if (settings) {
            set(settings);
          }
        },
      }),
      { name: "settingsStore", enabled: true },
    ),
  ),
);

const DB_SETTINGS = "settings";

// 防抖保存设置到存储
let settingsSaveTimeout: NodeJS.Timeout;
const timeout = 1000;

const getPersistedSettings = (settings: SettingsState) => ({
  expandSidebar: settings.expandSidebar,
  monacoEditorCDN: settings.monacoEditorCDN,
  chatStyle: settings.chatStyle,
  fontSize: settings.fontSize,
  timestampDecoderEnabled: settings.timestampDecoderEnabled,
  base64DecoderEnabled: settings.base64DecoderEnabled,
  unicodeDecoderEnabled: settings.unicodeDecoderEnabled,
  urlDecoderEnabled: settings.urlDecoderEnabled,
  imageDecoderEnabled: settings.imageDecoderEnabled,
  defaultIndentSize: settings.defaultIndentSize,
  newTabShortcut: settings.newTabShortcut,
  closeTabShortcut: settings.closeTabShortcut,
  persistentDataEnabled: settings.persistentDataEnabled,
});

const persistSettings = (settings: SettingsState) =>
  storageManager.set(DB_SETTINGS, getPersistedSettings(settings));

export async function flushSettingsStore(): Promise<void> {
  clearTimeout(settingsSaveTimeout);
  await persistSettings(useSettingsStore.getState());
}

useSettingsStore.subscribe(
  (state) => state,
  (settings) => {
    clearTimeout(settingsSaveTimeout);
    settingsSaveTimeout = setTimeout(() => {
      void persistSettings(settings).catch((error) => {
        console.error("Settings save failed", error);
        toast.error(
          "设置未能保存到本地",
          "当前设置仍在本窗口生效，请检查可用存储空间。",
        );
      });
    }, timeout);
  },
);
