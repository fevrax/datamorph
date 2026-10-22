import { ToolContext } from "@/components/workspace/ToolContext";
import {
  subscribeTasks,
  getPendingScopes,
  cancelJsonTask,
} from "@/workers/client";
import { ReactNode, useContext, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { useTabStore } from "@/store/useTabStore";
import { useLocation, useNavigate } from "react-router-dom";
import { useDelayedVisibility } from "@/hooks/useDelayedVisibility";
import "@/styles/tool-workspace.css";

interface ToolboxPageTemplateProps {
  description?: string;
  toolName: string; // 动态工具名称
  toolIcon?: string; // 工具图标
  toolIconColor?: string; // 工具图标颜色
  actions?: ReactNode; // 工具特定的操作按钮
  statusIndicator?: ReactNode; // 状态指示器
  children: ReactNode; // 主要内容区域（通常是编辑器）
}

export default function ToolboxPageTemplate({
  description,
  toolName,
  toolIcon = "solar:magic-stick-bold",
  toolIconColor = "text-primary",
  actions,
  statusIndicator,
  children,
}: ToolboxPageTemplateProps) {
  const key = useContext(ToolContext);
  const running = useSyncExternalStore(
    subscribeTasks,
    () =>
      getPendingScopes().filter((scope) => scope.startsWith(`tool:${key}:`))
        .length,
  );
  const showRunning = useDelayedVisibility(running > 0);
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname.startsWith("/toolbox");
  const handleBackToToolbox = () => {
    useTabStore.getState().openToolboxTab();
    if (location.pathname !== "/toolbox") navigate("/toolbox");
  };

  return (
    <div
      className={`tool-workspace bg-background w-full h-full min-h-0 flex flex-col${description ? " tool-workspace-redesigned" : ""}`}
    >
      <div
        className={
          description
            ? "tool-workspace-shell"
            : "w-full mx-auto px-3 py-2 flex-1 min-h-0 flex flex-col"
        }
      >
        {/* 头部区域 */}
        <div
          className={
            description
              ? "tool-workspace-heading"
              : "flex justify-between items-center mb-2"
          }
        >
          <div className="flex items-center gap-1.5">
            {showBackButton && (
              <Button
                isIconOnly
                aria-label="返回工具箱"
                size="sm"
                variant="light"
                onPress={handleBackToToolbox}
              >
                <Icon
                  className="text-muted-foreground"
                  icon="solar:arrow-left-outline"
                  width={18}
                />
              </Button>
            )}

            <div>
              <h1 className="text-base font-bold flex items-center ml-0.5">
                <Icon
                  className={`mr-1.5 ${toolIconColor}`}
                  icon={toolIcon}
                  width={18}
                />
                {toolName}
              </h1>
              {description && <p>{description}</p>}
            </div>
          </div>
        </div>

        {/* 操作和状态区域 */}
        {(actions || statusIndicator) && (
          <div
            className={
              description
                ? "tool-workspace-toolbar"
                : "mb-2 flex justify-between gap-1.5 items-center"
            }
          >
            <div
              className={
                description
                  ? "tool-workspace-actions"
                  : "flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 [&_button]:h-7 [&_button]:min-w-0 [&_button]:shrink-0 [&_button]:px-2 [&_button]:text-xs"
              }
            >
              {actions}
            </div>

            <div
              className={
                description
                  ? "tool-workspace-status"
                  : "flex shrink-0 items-center"
              }
            >
              {statusIndicator}
            </div>
          </div>
        )}

        {showRunning && (
          <div
            role="status"
            className="mb-2 flex items-center justify-between rounded border bg-accent px-3 py-1 text-xs"
          >
            正在后台处理…
            <Button
              size="sm"
              variant="ghost"
              onPress={() =>
                getPendingScopes()
                  .filter((scope) => scope.startsWith(`tool:${key}:`))
                  .forEach(cancelJsonTask)
              }
            >
              取消任务
            </Button>
          </div>
        )}
        {/* 主内容区域 */}
        {children}
      </div>
    </div>
  );
}
