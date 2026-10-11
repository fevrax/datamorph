import { useRef } from "react";
import { useTheme } from "next-themes";
import { ArrowUpRight, Braces, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import MonacoDataEditor, {
  type MonacoDataEditorRef,
} from "@/components/monacoEditor/MonacoDataEditor";
import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";
import { jsonPathExamples, jsonPathSample } from "@/utils/jsonPathExamples";
import { stringifyJson } from "@/utils/json";

const useToolState = createToolStateHook("jsonPath");
export default function JsonPathPage() {
  const [input, setInput] = useToolState("inputValue", () =>
    stringifyJson(jsonPathSample, 2),
  );
  const editor = useRef<MonacoDataEditorRef>(null);
  const { resolvedTheme } = useTheme();
  return (
    <ToolboxPageTemplate toolName="JSONPath 查询" toolIcon="mdi:filter">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/25 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-primary/15 bg-primary/10 p-2 text-primary">
              <Braces className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                从复杂 JSON 中，找到你需要的数据
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                编辑源数据 → 输入路径 → 即时查看匹配结果
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              setInput(stringifyJson(jsonPathSample, 2));
              editor.current?.setQuery("$.users[*].name");
            }}
          >
            <RotateCcw />
            载入示例数据
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-1">
          <section
            aria-label="JSONPath 示例"
            className="max-h-44 overflow-auto rounded-xl border bg-muted/15 lg:max-h-none"
          >
            <div className="border-b px-4 py-3">
              <h3 className="text-xs font-semibold">查询速查</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                点击套用 · 示例基于 users 数组
              </p>
            </div>
            <div className="space-y-1 p-2">
              {jsonPathExamples.map((example) => (
                <button
                  key={example.path}
                  className="group w-full rounded-lg p-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => editor.current?.setQuery(example.path)}
                >
                  <span className="flex items-center justify-between text-xs font-medium">
                    {example.title}
                    <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary" />
                  </span>
                  <code className="mt-1.5 block break-all font-mono text-[11px] leading-relaxed text-primary">
                    {example.path}
                  </code>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {example.description}
                  </span>
                </button>
              ))}
            </div>
            <p className="border-t px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              结果始终为数组，无匹配返回 []。下方「语法」可查看使用指南。
            </p>
          </section>
          <div className="min-h-64 overflow-hidden rounded-xl border lg:min-h-0">
            <MonacoDataEditor
              ref={editor}
              tabKey="jsonpath-playground"
              tabTitle="JSONPath 查询"
              value={input}
              onUpdateValue={setInput}
              showJsonPathFilter
              theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
            />
          </div>
        </div>
      </div>
    </ToolboxPageTemplate>
  );
}
