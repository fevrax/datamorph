import type { AIRouteType } from "@/store/useOpenAIConfigStore";

/**
 * AI 线路品牌标识。
 *
 * 原实现把品牌色以 hex 硬编码散落各处（#00C9A7 / #3D5AFE / ...），
 * 暗色模式下对比度差。这里集中管理：每条线路保留一组「主题色」用于
 * 卡片渐变与开关高亮，文本统一改用 shadcn/ui 语义色（text-foreground/500），
 * 既保留线路的视觉区分度，又能在明/暗模式下自适应。
 */

export interface RouteBrand {
  /** 主色（用于图标块、渐变起色、开关选中色） */
  color: string;
  /** 渐变次色（用于卡片底纹过渡） */
  to: string;
}

export const ROUTE_BRAND: Record<AIRouteType, RouteBrand> = {
  default: { color: "#00C9A7", to: "#00B597" },
  ssooai: { color: "#3D5AFE", to: "#304FFE" },
  utools: { color: "#FFAB00", to: "#FF9100" },
  custom: { color: "#E91E63", to: "#D81B60" },
};

export { AI_ROUTE_LABELS as ROUTE_LABEL } from "@/services/aiModelSelection";

export const ROUTE_ICON: Record<AIRouteType, string> = {
  default: "solar:chat-round-dots-bold-duotone",
  ssooai: "solar:magic-stick-3-bold-duotone",
  utools: "solar:atom-bold-duotone",
  custom: "solar:key-bold-duotone",
};
