import { useTabStore } from "@/store/useTabStore";
import {
  UtoolsEnterController,
  extractUtoolsEditorPayload,
  type UtoolsPluginEnterAction,
} from "./utoolsEnterCore";

export { extractUtoolsEditorPayload, type UtoolsPluginEnterAction };

/**
 * Utools 事件监听器管理
 *
 * 这个类负责管理 utools 插件的监听事件，
 * 包括插件进入时的数据处理。
 */
class UtoolsListener {
  private static instance: UtoolsListener;
  private isInitialized: boolean = false;
  private readonly controller = new UtoolsEnterController({
    isHydrated: () => useTabStore.getState().hydrated,
    subscribeHydrated: (listener) =>
      useTabStore.subscribe((state) => {
        if (state.hydrated) {
          listener();
        }
      }),
    getTabCount: () => useTabStore.getState().tabs.length,
    getActiveTab: () => useTabStore.getState().activeTab(),
    setView: (key, view) => useTabStore.getState().setView(key, view),
    updateTabContent: (key, content) =>
      useTabStore.getState().updateTabContent(key, content),
    addTab: (title, content) => useTabStore.getState().addTab(title, content),
    navigateToEditor: () => {
      if (
        typeof window !== "undefined" &&
        window.location &&
        window.location.hash &&
        window.location.hash !== "#/"
      ) {
        window.location.hash = "#/";
      }
    },
  });

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): UtoolsListener {
    if (!UtoolsListener.instance) {
      UtoolsListener.instance = new UtoolsListener();
    }

    return UtoolsListener.instance;
  }

  /**
   * 初始化监听器
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    if (typeof window !== "undefined" && (window as any).utools) {
      (window as any).utools.onPluginEnter((data: UtoolsPluginEnterAction) => {
        this.handlePluginEnter(data);
      });
      this.isInitialized = true;
      console.log("Utools 监听器已初始化");
    }
  }

  /**
   * 处理插件进入事件
   */
  public handlePluginEnter(data: UtoolsPluginEnterAction): void {
    try {
      this.controller.handlePluginEnter(data);
    } catch (error) {
      console.error("处理 Utools 插件进入事件时发生错误:", error);
    }
  }

  /**
   * 检查是否已初始化
   */
  public isListenerInitialized(): boolean {
    return this.isInitialized;
  }
}

export default UtoolsListener;
export { UtoolsListener };
