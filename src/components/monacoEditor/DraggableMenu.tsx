import type React from "react";
import { createPortal } from "react-dom";
import {
  Binary,
  CaseSensitive,
  Clock3,
  Image,
  Link2,
  RotateCcw,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { TimeZoneSelector } from "@/components/setting/TimeZoneSelector";
import { resolveTimeZone } from "@/utils/timeZone";
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Slider,
  Switch,
} from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
interface DraggableMenuProps {
  toolbarTarget?: HTMLElement | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onFontSizeChange: (fontSize: number) => void;
  onIndentSizeChange: (indentSize: number) => void;
  onIndentModeChange: (mode: "auto" | "manual") => void;
  onReset: () => void;
  currentFontSize: number;
  currentIndentSize: number;
  currentIndentMode: "auto" | "manual";
  insertSpaces: boolean;
  tabKey: string;
  timestampDecoratorsEnabled?: boolean; // 添加时间戳装饰器状态
  onTimestampDecoratorsChange?: (enabled: boolean) => void; // 添加时间戳装饰器状态变更函数
  base64DecoratorsEnabled?: boolean; // 添加Base64装饰器状态
  unicodeDecoratorsEnabled?: boolean; // 添加Unicode装饰器状态
  urlDecoratorsEnabled?: boolean; // 添加URL装饰器状态
  imageDecoratorsEnabled?: boolean; // 添加图片装饰器状态
  onBase64DecoratorsChange?: (enabled: boolean) => void; // 添加Base64装饰器状态变更函数
  onUnicodeDecoratorsChange?: (enabled: boolean) => void; // 添加Unicode装饰器状态变更函数
  onUrlDecoratorsChange?: (enabled: boolean) => void; // 添加URL装饰器状态变更函数
  onImageDecoratorsChange?: (enabled: boolean) => void; // 添加图片装饰器状态变更函数
}
function ToggleRow({
  icon: Icon,
  label,
  enabled,
  onChange,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  enabled: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[13px]">
        <Icon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        {label}
      </span>
      <Switch
        aria-label={label}
        isSelected={enabled}
        isDisabled={disabled}
        onValueChange={onChange}
      />
    </div>
  );
}

export default function DraggableMenu(props: DraggableMenuProps) {
  const settings = useSettingsStore();
  const menu = (
    <div
      className={
        props.toolbarTarget ? "flex shrink-0" : "absolute right-3 top-2 z-20"
      }
    >
      <Popover>
        <PopoverTrigger>
          <Button
            aria-label="编辑器设置"
            variant="ghost"
            size="sm"
            isIconOnly
            className={
              props.toolbarTarget
                ? "text-muted-foreground"
                : "border bg-background/95 text-muted-foreground"
            }
          >
            <Settings2 />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label="编辑器设置"
          collisionPadding={12}
          className="w-[460px] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl p-0 shadow-xl"
          style={{ maxHeight: "var(--radix-popover-content-available-height)" }}
        >
          <div className="flex items-center justify-between gap-4 px-5 pb-1 pt-5">
            <h3 className="text-base font-semibold tracking-tight">
              编辑器设置
            </h3>
            <span className="text-[11px] text-muted-foreground">即时生效</span>
          </div>

          <section className="px-5 pb-5 pt-4" aria-label="排版设置">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground">
                排版
              </h4>
              <span className="text-[11px] text-muted-foreground">
                当前编辑器
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[480px]:gap-5">
              <div>
                <div className="flex h-7 items-center justify-between text-[13px]">
                  <span>字体大小</span>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums">
                    {props.currentFontSize} px
                  </span>
                </div>
                <Slider
                  aria-label="字体大小"
                  className="mt-2"
                  minValue={12}
                  maxValue={24}
                  value={props.currentFontSize}
                  onChange={(v) => props.onFontSizeChange(Number(v))}
                />
              </div>
              <div className="min-[480px]:border-l min-[480px]:border-border/70 min-[480px]:pl-5">
                <div className="flex h-7 items-center justify-between gap-2 text-[13px]">
                  <span>缩进</span>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums">
                    {props.insertSpaces
                      ? `${props.currentIndentSize} 空格`
                      : `Tab · ${props.currentIndentSize}`}
                  </span>
                </div>
                <div className="mt-2 flex h-8 items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    自动识别缩进
                  </span>
                  <Switch
                    aria-label="自动识别缩进"
                    isSelected={props.currentIndentMode === "auto"}
                    onValueChange={(enabled) =>
                      props.onIndentModeChange(enabled ? "auto" : "manual")
                    }
                  />
                </div>
                {props.currentIndentMode === "manual" && (
                  <Slider
                    aria-label="缩进"
                    minValue={1}
                    maxValue={10}
                    value={props.currentIndentSize}
                    onChange={(v) => props.onIndentSizeChange(Number(v))}
                  />
                )}
              </div>
            </div>
          </section>

          <section
            className="border-t border-border/70 px-5 py-4"
            aria-label="智能提示设置"
          >
            <h4 className="mb-3 text-xs font-medium text-muted-foreground">
              智能提示
            </h4>
            <div className="rounded-xl bg-muted/45 px-3.5 pb-3 pt-1">
              <ToggleRow
                icon={Clock3}
                label="时间戳提示"
                enabled={
                  settings.timestampDecoderEnabled &&
                  (props.timestampDecoratorsEnabled ?? true)
                }
                disabled={!settings.timestampDecoderEnabled}
                onChange={props.onTimestampDecoratorsChange}
              />
              <div className="mt-1 flex items-start gap-3">
                <span className="flex h-9 shrink-0 items-center text-xs text-muted-foreground">
                  显示时区
                </span>
                <div className="min-w-0 flex-1">
                  <TimeZoneSelector />
                  <p className="mt-1.5 break-words text-[11px] leading-relaxed text-muted-foreground">
                    {resolveTimeZone(settings.timestampTimeZone)} · 全局同步
                  </p>
                </div>
              </div>
              {!settings.timestampDecoderEnabled && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  在系统设置的「自动解码」中启用时间戳提示
                </p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 min-[480px]:grid-cols-2">
              <ToggleRow
                icon={Binary}
                label="Base64 解码"
                enabled={settings.base64DecoderEnabled}
                onChange={settings.setBase64DecoderEnabled}
              />
              <ToggleRow
                icon={CaseSensitive}
                label="Unicode 解码"
                enabled={settings.unicodeDecoderEnabled}
                onChange={settings.setUnicodeDecoderEnabled}
              />
              <ToggleRow
                icon={Link2}
                label="URL 解码"
                enabled={settings.urlDecoderEnabled}
                onChange={settings.setUrlDecoderEnabled}
              />
              <ToggleRow
                icon={Image}
                label="图片预览"
                enabled={
                  settings.imageDecoderEnabled &&
                  (props.imageDecoratorsEnabled ?? true)
                }
                onChange={(value) => {
                  settings.setImageDecoderEnabled(value);
                  props.onImageDecoratorsChange?.(value);
                }}
              />
            </div>
          </section>
          <div className="flex justify-end border-t border-border/70 px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-muted-foreground"
              onPress={props.onReset}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              恢复默认排版
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
  return props.toolbarTarget ? createPortal(menu, props.toolbarTarget) : menu;
}
