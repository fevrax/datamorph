import { Children, useEffect, useState, type ReactNode } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { cn } from "@/components/ui";
interface Props {
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  children?: ReactNode;
  initialLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
  onResize?: (size: number) => void;
  onResizeComplete?: (size: number) => void;
  resizeHandle?: ReactNode;
  isStacked?: boolean;
}
export default function ResizableEditorLayout({
  leftPanel,
  rightPanel,
  children,
  initialLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
  className,
  onResize,
  onResizeComplete,
  isStacked = false,
}: Props) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const resize = () => setNarrow(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const panels = children
    ? Children.toArray(children)
    : [leftPanel, rightPanel].filter(Boolean);
  const vertical = isStacked || narrow;
  return (
    <PanelGroup
      direction={vertical ? "vertical" : "horizontal"}
      className={cn("h-full min-h-0 w-full", className)}
      onLayout={(sizes) => {
        onResize?.(sizes[0]);
        onResizeComplete?.(sizes[0]);
      }}
    >
      <Panel
        defaultSize={initialLeftWidth}
        minSize={minLeftWidth}
        maxSize={panels.length > 1 ? maxLeftWidth : 100}
      >
        <div className="h-full min-h-0 overflow-hidden">{panels[0]}</div>
      </Panel>
      {panels.length > 1 && (
        <>
          <PanelResizeHandle
            aria-label="调整输入输出区域"
            className={cn(
              "bg-border transition-colors hover:bg-primary focus-visible:bg-primary",
              vertical ? "h-1" : "w-1",
            )}
          />
          <Panel minSize={100 - maxLeftWidth}>
            <div className="h-full min-h-0 overflow-hidden">{panels[1]}</div>
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
