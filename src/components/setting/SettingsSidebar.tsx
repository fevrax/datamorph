import { cn, Tooltip } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import {
  WorkspaceNavigationTrigger,
  WorkspaceSearchTrigger,
} from "@/components/workspace/WorkspaceActions";

/** 设置页二级导航项 */
export interface SettingsMenuItem {
  key: string;
  label: string;
  icon: string;
}

interface SettingsSidebarProps {
  items: SettingsMenuItem[];
  activeTab: string;
  onSelect: (key: string) => void;
}

/**
 * 设置页左侧导航（Apple 系统风）：始终是竖排图标条，选中项用圆角高亮块 +
 * 强调色，未选中保持中性灰。宽屏（≥ md）在图标右侧显示文字标签。
 * 窄屏纯图标，hover 时 Tooltip 显示名称。
 */
export function SettingsSidebar({
  items,
  activeTab,
  onSelect,
}: SettingsSidebarProps) {
  return (
    <div className="flex h-full w-[60px] flex-shrink-0 flex-col border-r border-border/70 bg-background/80 backdrop-blur-md dark:bg-muted/20 md:w-[188px]">
      {/* 标题区 */}
      <div className="flex flex-wrap items-center justify-center gap-1 px-2 pb-2 pt-3 md:justify-between md:px-3">
        <WorkspaceNavigationTrigger />
        <p className="hidden text-[10.5px] font-medium text-muted-foreground md:block">
          设置
        </p>
        <WorkspaceSearchTrigger compact />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 md:p-2.5">
        {items.map((item) => {
          const isActive = activeTab === item.key;
          const button = (
            <button
              aria-label={item.label}
              aria-pressed={isActive}
              className={cn(
                "flex h-9 w-full items-center justify-center gap-2 rounded-lg px-2 text-left transition-colors md:justify-start md:px-2.5",
                isActive
                  ? "bg-foreground text-background shadow-sm dark:bg-secondary dark:text-foreground"
                  : "text-muted-foreground hover:bg-secondary dark:text-muted-foreground dark:hover:bg-secondary/40",
              )}
              onClick={() => onSelect(item.key)}
            >
              <Icon className="flex-shrink-0" icon={item.icon} width={18} />
              <span className="hidden truncate text-[12px] font-medium md:inline">
                {item.label}
              </span>
            </button>
          );

          // 窄屏纯图标模式用 Tooltip 显示名称
          return (
            <Tooltip
              key={item.key}
              className="md:hidden"
              content={item.label}
              delay={200}
              placement="right"
            >
              {button}
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
}
