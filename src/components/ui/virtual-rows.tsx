import {
  cloneElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
export function VirtualRows<T>({
  items,
  children,
  columns = 20,
}: {
  items: T[];
  children: (item: T, index: number) => ReactElement | null;
  columns?: number;
}) {
  const body = useRef<HTMLTableSectionElement>(null);
  const [scroll, setScroll] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const element = body.current?.closest(
      "[data-table-scroll]",
    ) as HTMLElement | null;
    setScroll(element);
    if (body.current && element)
      setMargin(
        body.current.getBoundingClientRect().top -
          element.getBoundingClientRect().top +
          element.scrollTop,
      );
  }, [items]);
  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroll,
    estimateSize: () => 34,
    overscan: 12,
    scrollMargin: margin,
  });
  if (items.length < 150)
    return <tbody ref={body}>{items.map(children)}</tbody>;
  const rows = virtual.getVirtualItems();
  return (
    <tbody ref={body}>
      {rows.length > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={columns}
            style={{
              height: Math.max(0, rows[0].start - margin),
              padding: 0,
              border: 0,
            }}
          />
        </tr>
      )}
      {rows.map((row) => {
        const element = children(items[row.index], row.index);
        return element
          ? cloneElement(element, {
              key: row.key,
              "data-index": row.index,
              ref: virtual.measureElement,
            } as Record<string, unknown>)
          : null;
      })}
      {rows.length > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={columns}
            style={{
              height: Math.max(
                0,
                virtual.getTotalSize() - (rows[rows.length - 1].end - margin),
              ),
              padding: 0,
              border: 0,
            }}
          />
        </tr>
      )}
    </tbody>
  );
}
