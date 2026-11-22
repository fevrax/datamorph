import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import clipboard from "@/utils/clipboard";
import {
  formatNodePath,
  type ColumnRequest,
  type ColumnResponse,
  type NodePath,
} from "@/workers/jsonColumns";

function nodeLabel(key: string | number) {
  return typeof key === "number" ? `[${key}]` : key || '""';
}

export default function JsonColumnView({
  content,
  language,
  onEdit,
}: {
  content: string;
  language: string;
  onEdit: () => void;
}) {
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const pages = useRef<ColumnRequest["pages"]>({});
  const [result, setResult] = useState<ColumnResponse>();
  const breadcrumbs = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef(false);

  const empty = !content.trim();
  useEffect(() => {
    if (empty) return;
    const parser = new Worker(
      new URL("../../workers/jsonColumns.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = parser;
    parser.onmessage = ({ data }: MessageEvent<ColumnResponse>) => {
      if (data.id === requestId.current) setResult(data);
    };
    parser.onerror = () => {
      setResult({ id: requestId.current, error: "后台解析失败" });
    };
    parser.postMessage({
      id: ++requestId.current,
      path: [],
      pages: {},
      document: { content, language },
    } satisfies ColumnRequest);
    return () => {
      parser.terminate();
      worker.current = null;
    };
  }, [content, empty, language]);

  useLayoutEffect(() => {
    const nav = breadcrumbs.current;
    const current = nav?.querySelector<HTMLButtonElement>(
      '[aria-current="location"]',
    );
    if (nav && current) nav.scrollLeft = nav.scrollWidth;
    if (
      focusAfterNavigation.current &&
      document.activeElement === document.body
    )
      current?.focus({ preventScroll: true });
    focusAfterNavigation.current = false;
  }, [result]);

  function navigate(path: NodePath, nextPages: ColumnRequest["pages"] = {}) {
    if (!worker.current) return;
    focusAfterNavigation.current = true;
    pages.current = nextPages;
    worker.current.postMessage({
      id: ++requestId.current,
      path,
      pages: nextPages,
    } satisfies ColumnRequest);
  }

  const error = result && "error" in result ? result.error : undefined;
  if (empty || !result || "error" in result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm">
        {empty || error !== undefined ? (
          <>
            <p role={empty ? "status" : "alert"}>
              {empty ? "暂无内容可浏览" : `无法浏览文档：${error}`}
            </p>
            <Button size="sm" variant="outline" onPress={onEdit}>
              返回编辑
            </Button>
          </>
        ) : (
          <Spinner label="正在解析文档…" />
        )}
      </div>
    );
  }

  const { path, columns, preview, type } = result.view;
  const selectedPath = formatNodePath(path);
  const crumbs = [[], ...path.map((_, index) => path.slice(0, index + 1))];

  return (
    <section
      aria-label="JSON 栏列浏览"
      className="@container flex h-full min-w-0 flex-col"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <nav
          ref={breadcrumbs}
          aria-label="节点路径"
          className="flex min-w-0 flex-1 items-center overflow-x-auto"
        >
          {crumbs.map((crumb, index) => {
            const current = index === path.length;
            return (
              <div
                key={formatNodePath(crumb)}
                className="flex shrink-0 items-center gap-0.5"
              >
                {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
                <Button
                  size="sm"
                  variant="ghost"
                  className={`max-w-48 font-mono ${current ? "bg-accent text-accent-foreground" : ""}`}
                  aria-current={current ? "location" : undefined}
                  onPress={() => navigate(crumb)}
                  title={formatNodePath(crumb)}
                >
                  <span className="truncate">
                    {index === 0 ? "$" : nodeLabel(path[index - 1])}
                  </span>
                </Button>
              </div>
            );
          })}
        </nav>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onPress={() => void clipboard.copy(selectedPath, "已复制路径")}
        >
          <Copy />
          复制路径
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto @lg:overflow-hidden">
        <div className="grid min-h-full @lg:h-full @lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.25fr)]">
          {columns.map((column) => {
            const parent = path.slice(0, column.depth);
            const parentLabel = parent.length
              ? nodeLabel(parent[parent.length - 1])
              : "根节点";
            const changePage = (page: number) =>
              navigate(path, { ...pages.current, [column.depth]: page });
            return (
              <section
                key={formatNodePath(parent)}
                aria-label={`${parentLabel} 子节点`}
                className="flex min-h-0 min-w-0 flex-col border-b @lg:border-r @lg:border-b-0"
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <h3 className="truncate font-mono" title={parentLabel}>
                    {parentLabel}
                  </h3>
                  <span className="shrink-0">{column.count} 项</span>
                </div>
                <ul
                  key={column.page}
                  className="max-h-52 min-h-0 flex-1 space-y-0.5 overflow-auto p-1.5 @lg:max-h-none"
                >
                  {column.rows.map((row) => {
                    const active = path[column.depth] === row.key;
                    return (
                      <li key={row.key}>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-current={active ? "true" : undefined}
                          title={nodeLabel(row.key)}
                          className={`w-full justify-start gap-2 px-2 font-mono ${active ? "bg-accent text-accent-foreground" : ""}`}
                          onPress={() => navigate([...parent, row.key])}
                        >
                          <span className="min-w-0 flex-1 truncate text-left">
                            {nodeLabel(row.key)}
                          </span>
                          <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                            {row.summary}
                          </span>
                          {row.branch && <ChevronRight aria-hidden="true" />}
                        </Button>
                      </li>
                    );
                  })}
                  {!column.count && (
                    <li className="px-2 py-1 text-sm text-muted-foreground">
                      没有子节点
                    </li>
                  )}
                </ul>
                {column.pageCount > 1 && (
                  <div className="flex shrink-0 items-center justify-between gap-1 border-t px-1.5 py-1 text-xs">
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="上一页"
                      isDisabled={column.page === 0}
                      onPress={() => changePage(column.page - 1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <span>
                      {column.page + 1} / {column.pageCount}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="下一页"
                      isDisabled={column.page + 1 === column.pageCount}
                      onPress={() => changePage(column.page + 1)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
          {columns.length === 1 && (
            <div className="hidden border-r p-3 text-xs text-muted-foreground @lg:block">
              选择对象或数组以浏览下一层
            </div>
          )}
          <div
            className={`min-h-0 min-w-0 overflow-auto bg-muted/30 p-3 ${columns.length ? "" : "@lg:col-span-3"}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <h3>节点预览</h3>
              <span className="font-mono">{type}</span>
            </div>
            <code role="status" className="block text-xs wrap-anywhere">
              {selectedPath}
            </code>
            <pre className="mt-2 text-sm whitespace-pre-wrap wrap-anywhere">
              {preview}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
