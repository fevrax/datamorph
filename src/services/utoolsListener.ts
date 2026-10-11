import { useTabStore } from "@/store/useTabStore";

/**
 * Utools 事件监听器管理
 *
 * 这个类负责管理 utools 插件的监听事件，
 * 包括插件进入时的数据处理。
 */
class UtoolsListener {
  private static instance: UtoolsListener;
  private isInitialized: boolean = false;

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
      (window as any).utools.onPluginEnter((data: any) => {
        this.handlePluginEnter(data);
      });
      this.isInitialized = true;
      console.log("Utools 监听器已初始化");
    }
  }

  /**
   * 处理插件进入事件
   */
  private handlePluginEnter(data: any): void {
    if (!useTabStore.getState().hydrated) {
      const unsubscribe = useTabStore.subscribe((state) => {
        if (state.hydrated) {
          unsubscribe();
          this.handlePluginEnter(data);
        }
      });
      return;
    }
    try {
      if (
        (data.type === "regex" || data.type === "text") &&
        typeof data.payload === "string" &&
        data.payload !== ""
      ) {
        const store = useTabStore.getState();
        const current = store.activeTab();
        if (
          current?.kind === "document" &&
          store.tabs.length === 1 &&
          current.content.trim() === ""
        ) {
          store.updateTabContent(current.key, data.payload);
        } else {
          store.addTab(undefined, data.payload);
        }
      }
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
