import { useState } from "react";
import { Popover } from "radix-ui";
import { ArrowUpRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui";
import { jsonPathExamples } from "@/utils/jsonPathExamples";

export default function JsonPathHelp({
  onSelect,
}: {
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          aria-label="JSONPath 说明"
          title="JSONPath 说明"
        >
          <BookOpen />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          aria-label="JSONPath 说明"
          className="z-[100] w-[540px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-start justify-between border-b bg-muted/40 p-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="size-4 text-primary" />
                JSONPath 使用指南
              </div>
              <p className="text-xs text-muted-foreground">
                点击示例即可填入当前输入框。
              </p>
            </div>
            <Popover.Close asChild>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="关闭说明"
              >
                <X />
              </Button>
            </Popover.Close>
          </div>

          <div className="max-h-[min(60vh,460px)] overflow-y-auto p-4">
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {[
                ["$", "根节点"],
                ["@", "当前项"],
                ["*", "通配符"],
                ["..", "递归"],
                ["[?()]", "条件"],
              ].map(([symbol, label]) => (
                <span key={symbol} className="rounded-md border px-2 py-1">
                  <code className="mr-1.5 font-mono text-primary">
                    {symbol}
                  </code>
                  {label}
                </span>
              ))}
            </div>

            <div className="space-y-2">
              {jsonPathExamples.map((example) => (
                <button
                  key={example.path}
                  type="button"
                  className="group block w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    onSelect(example.path);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center justify-between text-xs font-medium">
                    {example.title}
                    <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary" />
                  </span>
                  <code className="mt-1 block break-all font-mono text-xs text-primary">
                    {example.path}
                  </code>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {example.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>RFC 9535</span>
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc9535.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              标准文档
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
