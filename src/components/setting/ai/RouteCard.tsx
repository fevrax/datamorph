import type { ReactNode } from "react";
import type { AIRouteType } from "@/store/useOpenAIConfigStore";

import { Button, Switch } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

import { ROUTE_BRAND, ROUTE_ICON, ROUTE_LABEL } from "./aiRoutes";

interface RouteCardProps {
  routeType: AIRouteType;
  description: ReactNode;
  isSelected: boolean;
  /** 线路是否可用（uTools 需在 uTools 环境内） */
  available?: boolean;
  /** 是否显示「配置」按钮（ssooai / custom 有） */
  showConfigure?: boolean;
  onToggle: (enabled: boolean) => void;
  onConfigure?: () => void;
}

/**
 * 单个 AI 线路卡片（Apple 系统风）：白色圆角卡片 + 品牌色图标块 +
 * 状态徽标（绿=启用 / 灰=不可用）+ 开关/配置按钮。
 */
export function RouteCard({
  routeType,
  description,
  isSelected,
  available = true,
  showConfigure = false,
  onToggle,
  onConfigure,
}: RouteCardProps) {
  const brand = ROUTE_BRAND[routeType];
  const enabled = isSelected && available;

  return (
    <div className="flex min-h-[138px] flex-col justify-between gap-3 rounded-lg border border-border/70 bg-background p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-input dark:bg-muted/30 sm:p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${brand.color}1f`,
            color: brand.color,
          }}
        >
          <Icon icon={ROUTE_ICON[routeType]} width={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">
            {ROUTE_LABEL[routeType]}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {description}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!available ? (
          <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
            ● 不可用
          </span>
        ) : routeType === "default" ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-semibold text-success">
            ● 始终启用
          </span>
        ) : enabled ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-semibold text-success">
            ● 已启用
          </span>
        ) : (
          <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
            ● 已关闭
          </span>
        )}

        <div className="flex items-center gap-2">
          {showConfigure && onConfigure ? (
            <Button
              radius="full"
              size="sm"
              variant="flat"
              onPress={onConfigure}
            >
              配置
            </Button>
          ) : null}
          <Switch
            color="success"
            isDisabled={!available || routeType === "default"}
            isSelected={enabled}
            size="sm"
            onValueChange={onToggle}
          />
        </div>
      </div>
    </div>
  );
}
