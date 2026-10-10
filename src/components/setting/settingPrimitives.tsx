import type { ReactNode } from "react";

import { cn } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

/**
 * 设置页视觉原语（Apple 系统风）。
 *
 * 设计语言：浅灰底（muted）+ 纯白圆角分组卡片 + 彩色圆角图标块 +
 * macOS 胶囊开关 + 小号大写分组标题。所有颜色走 设计系统 语义色，暗色模式自动适配。
 */

/** 图标圆角块的色调 —— Apple 系统设置风格的彩色方块 */
export type SettingTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "neutral";

const TONE_CLASSES: Record<SettingTone, string> = {
  // 彩色方块（白字图标）—— 仿 macOS 系统设置
  primary: "bg-primary text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  info: "bg-blue-500 text-white",
  violet: "bg-purple-500 text-white",
  neutral: "bg-border text-foreground",
};

interface SectionHeaderProps {
  title: string;
  description?: string;
}

/** 每个 tab 顶部的统一标题（无图标块，纯文字，更克制） */
export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold tracking-normal text-foreground sm:text-xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground sm:text-[13px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

interface GroupLabelProps {
  children: ReactNode;
}

/** 分组小标题：小号大写灰字，仿 macOS 设置的分组标签 */
export function GroupLabel({ children }: GroupLabelProps) {
  return (
    <h4 className="mb-2 mt-5 px-3 text-[11.5px] font-medium text-muted-foreground first:mt-0">
      {children}
    </h4>
  );
}

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  /** 是否以分隔线分隔内部多行（列表式分组） */
  divided?: boolean;
  /** 是否去掉内边距（由内部行自行控制） */
  flush?: boolean;
}

/** 设置分组容器：纯白圆角卡片 + 轻阴影 + 细边框 */
export function SectionCard({
  children,
  className,
  divided = false,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/70 bg-background shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-muted/30",
        divided && "divide-y divide-border/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SettingRowProps {
  icon: string;
  title: string;
  description?: ReactNode;
  tone?: SettingTone;
  /** 右侧控件区 */
  children?: ReactNode;
  className?: string;
}

/** 单个设置行：彩色圆角图标 + 标题/描述（左） + 控件（右），窄屏自动换行 */
export function SettingRow({
  icon,
  title,
  description,
  tone = "neutral",
  children,
  className,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[60px] flex-col gap-3 px-3 py-3 transition-colors hover:bg-muted/80 sm:flex-row sm:items-center sm:justify-between sm:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
            TONE_CLASSES[tone],
          )}
        >
          <Icon icon={icon} width={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">{title}</p>
          {description ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className="flex w-full min-w-0 items-center justify-start gap-2 sm:w-auto sm:justify-end">
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface InfoNoteProps {
  icon?: string;
  title?: string;
  tone?: SettingTone;
  className?: string;
  children: ReactNode;
}

/** 信息提示块（快捷键说明、解码器说明等） */
export function InfoNote({
  icon = "solar:info-circle-bold",
  title,
  tone = "primary",
  className,
  children,
}: InfoNoteProps) {
  return (
    <div
      className={cn(
        "mx-3 my-3 flex items-start gap-3 rounded-lg border p-3 sm:mx-4",
        tone === "warning"
          ? "border-warning/20 bg-warning/10"
          : tone === "primary"
            ? "border-primary/20 bg-primary/10"
            : "border-border bg-secondary/50",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 flex-shrink-0",
          tone === "warning"
            ? "text-warning"
            : tone === "primary"
              ? "text-primary"
              : "text-muted-foreground",
        )}
        icon={icon}
        width={18}
      />
      <div className="text-[12px] leading-relaxed text-foreground">
        {title ? (
          <p
            className={cn(
              "mb-1 font-semibold",
              tone === "primary" && "text-primary",
              tone === "warning" && "text-warning",
            )}
          >
            {title}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

interface ChoiceCardProps {
  selected: boolean;
  onSelect: () => void;
  /** 右上角勾选徽标 */
  badge?: boolean;
  className?: string;
  children: ReactNode;
}

/** 可视化选择卡片（聊天样式、字体大小等）：选中后紫色描边 + 勾选徽标 */
export function ChoiceCard({
  selected,
  onSelect,
  badge = true,
  className,
  children,
}: ChoiceCardProps) {
  return (
    <div
      aria-pressed={selected}
      className={cn(
        "relative cursor-pointer rounded-lg border p-3 transition-colors",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border/70 bg-background hover:border-input hover:bg-muted/50",
        className,
      )}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      {badge && selected ? (
        <div className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-white">
          <Icon icon="solar:check-circle-bold" width={14} />
        </div>
      ) : null}
      {children}
    </div>
  );
}

interface ControlSlotProps {
  children: ReactNode;
  className?: string;
  align?: "end" | "stretch";
}

export function ControlSlot({
  children,
  className,
  align = "end",
}: ControlSlotProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        align === "end"
          ? "w-full justify-start sm:w-auto sm:justify-end"
          : "w-full flex-wrap justify-start sm:w-auto sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  icon?: string;
  description?: ReactNode;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  icon,
  description,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label
        className="flex items-center gap-2 text-[12.5px] font-medium text-foreground"
        htmlFor={id}
      >
        {icon ? (
          <Icon className="text-muted-foreground" icon={icon} width={15} />
        ) : null}
        {label}
      </label>
      {children}
      {description ? (
        <div className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </code>
  );
}
