export interface UtoolsPluginEnterAction {
  code?: string;
  type?: string;
  payload?: unknown;
}

export interface UtoolsActiveTabSnapshot {
  key: string;
  kind: "document" | "toolbox" | "tool";
  content: string;
  view: string;
}

export interface UtoolsEnterTarget {
  isHydrated: () => boolean;
  subscribeHydrated: (listener: () => void) => () => void;
  getTabCount: () => number;
  getActiveTab: () => UtoolsActiveTabSnapshot | undefined;
  setView: (key: string, view: "code") => void;
  updateTabContent: (key: string, content: string) => void;
  addTab: (title: string | undefined, content: string) => void;
  navigateToEditor?: () => void;
}

/**
 * 提取应填充到编辑器的 uTools 入口文本。
 * - `regex`：正则匹配指令传入的文本（如 JSON 格式化）
 * - `over`：任意文本匹配指令传入的文本（5 个字符以上任意文本）
 * - 忽略 `text`（关键词指令本身的名称，例如 "json" / "datamorph"）
 */
export function extractUtoolsEditorPayload(
  data: UtoolsPluginEnterAction | null | undefined,
): string | null {
  if (!data || (data.type !== "regex" && data.type !== "over")) {
    return null;
  }
  if (typeof data.payload !== "string" || data.payload === "") {
    return null;
  }
  return data.payload;
}

export class UtoolsEnterController {
  private pendingPayload: string | null = null;
  private unsubscribeHydration: (() => void) | null = null;

  constructor(private readonly target: UtoolsEnterTarget) {}

  public handlePluginEnter(data: UtoolsPluginEnterAction): void {
    const payload = extractUtoolsEditorPayload(data);
    if (payload === null) {
      return;
    }

    if (!this.target.isHydrated()) {
      this.pendingPayload = payload;
      if (!this.unsubscribeHydration) {
        this.unsubscribeHydration = this.target.subscribeHydrated(() => {
          if (!this.target.isHydrated()) {
            return;
          }
          const unsubscribe = this.unsubscribeHydration;
          this.unsubscribeHydration = null;
          unsubscribe?.();
          const next = this.pendingPayload;
          this.pendingPayload = null;
          if (next !== null) {
            this.fillEditor(next);
          }
        });
      }
      return;
    }

    this.fillEditor(payload);
  }

  private fillEditor(payload: string): void {
    const current = this.target.getActiveTab();
    if (
      current?.kind === "document" &&
      this.target.getTabCount() === 1 &&
      current.content.trim() === ""
    ) {
      if (current.view !== "code") {
        this.target.setView(current.key, "code");
      }
      this.target.updateTabContent(current.key, payload);
    } else {
      this.target.addTab(undefined, payload);
    }
    this.target.navigateToEditor?.();
  }
}
