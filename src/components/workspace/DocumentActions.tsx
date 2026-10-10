import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui";

export interface DocumentAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function DocumentActions({
  actions,
  endContent,
}: {
  actions: DocumentAction[];
  endContent?: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const measurements = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const layoutKey = actions
    .map(({ key, label }) => `${key}:${label}`)
    .join("|");

  useLayoutEffect(() => {
    const element = container.current;
    const measurement = measurements.current;
    if (!element || !measurement) return;

    const measure = () => {
      const widths = Array.from(
        measurement.children,
        (child) => child.getBoundingClientRect().width,
      );
      const moreWidth = widths.pop() ?? 0;
      const gap = parseFloat(getComputedStyle(measurement).columnGap) || 0;
      const available = element.getBoundingClientRect().width;
      const total =
        widths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, widths.length - 1) * gap;
      if (total <= available) {
        setVisibleCount(widths.length);
        return;
      }
      let used = moreWidth;
      let count = 0;
      for (const width of widths) {
        if (used + gap + width > available) break;
        used += gap + width;
        count++;
      }
      setVisibleCount(count);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(measurement);
    return () => observer.disconnect();
  }, [layoutKey]);

  const renderAction = (action: DocumentAction, measuring = false) => (
    <Button
      key={action.key}
      size="sm"
      variant="ghost"
      className={action.destructive ? "text-destructive" : undefined}
      isDisabled={action.disabled}
      tabIndex={measuring ? -1 : undefined}
      onPress={measuring ? undefined : action.onPress}
    >
      <action.icon />
      {action.label}
    </Button>
  );
  const hiddenActions = actions.slice(visibleCount);
  return (
    <div
      role="group"
      aria-label="文档操作"
      className={`relative flex flex-1 items-center justify-end gap-1 ${endContent ? "min-w-[68px]" : "min-w-8"}`}
    >
      <div
        ref={container}
        className="relative flex min-w-0 flex-1 items-center justify-end gap-1"
      >
        {actions.slice(0, visibleCount).map((action) => renderAction(action))}
        {hiddenActions.length > 0 && (
          <Dropdown>
            <DropdownTrigger>
              <Button
                size="sm"
                variant="ghost"
                aria-label="更多文档操作"
                isIconOnly
              >
                <MoreHorizontal />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="更多文档操作">
              {hiddenActions.map((action) => (
                <DropdownItem
                  key={action.key}
                  startContent={<action.icon className="size-4" />}
                  className={
                    action.destructive ? "text-destructive" : undefined
                  }
                  isDisabled={action.disabled}
                  onPress={action.onPress}
                >
                  {action.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        )}
        {/* Keep intrinsic sizes measurable without adding focus targets or overflow. */}
        <div
          className="pointer-events-none invisible absolute inset-0 overflow-hidden"
          aria-hidden="true"
          inert
        >
          <div ref={measurements} className="flex w-max items-center gap-1">
            {actions.map((action) => renderAction(action, true))}
            <Button size="sm" variant="ghost" isIconOnly tabIndex={-1}>
              <MoreHorizontal />
            </Button>
          </div>
        </div>
      </div>
      {endContent}
    </div>
  );
}
