import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
export function VirtualList<T>({
  items,
  children,
}: {
  items: T[];
  children: (item: T) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const list = useVirtualizer({
    count: items.length,
    getScrollElement: () => root.current,
    estimateSize: () => 28,
    overscan: 5,
  });
  return (
    <div
      ref={root}
      className="max-h-48 overflow-auto"
      style={{ height: Math.min(192, items.length * 28) }}
    >
      <div className="relative w-full" style={{ height: list.getTotalSize() }}>
        {list.getVirtualItems().map((row) => (
          <div
            key={row.key}
            className="absolute left-0 top-0 w-full"
            style={{
              height: row.size,
              transform: `translateY(${row.start}px)`,
            }}
          >
            {children(items[row.index])}
          </div>
        ))}
      </div>
    </div>
  );
}
