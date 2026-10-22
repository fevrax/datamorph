import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ListOrdered, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import { useBackgroundTask } from "@/components/workspace/useBackgroundTask";
import MonacoDiffEditor, {
  type MonacoDiffEditorRef,
} from "@/components/monacoEditor/MonacoDiffEditor";
import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";

const useToolState = createToolStateHook("protoSort");
const example = `syntax = "proto3";

message User {
  reserved 2;
  string name = 8;
  oneof contact {
    string email = 5;
    string phone = 4;
  }
  message Address {
    string city = 9;
  }
  Address address = 7;
}`;

export default function ProtoSortPage() {
  const [input, setInput] = useToolState("inputValue", "");
  const [output, setOutput] = useToolState("outputValue", "");
  const [hasResult, setHasResult] = useToolState("hasResult", false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settingsTarget, setSettingsTarget] = useState<HTMLSpanElement | null>(
    null,
  );
  const editor = useRef<MonacoDiffEditorRef>(null);
  const { resolvedTheme } = useTheme();
  const task = useBackgroundTask(input, "sort");

  function clearResult() {
    setOutput("");
    setHasResult(false);
    setError("");
  }
  function updateInput(value: string) {
    if (value === input) return;
    task.cancel();
    setInput(value);
    clearResult();
  }
  async function sort() {
    if (busy || !input.trim()) return;
    clearResult();
    setBusy(true);
    try {
      const result = await task.run({
        action: "renumber-proto",
        content: input,
        language: "proto",
      });
      setOutput(result.content ?? "");
      setHasResult(true);
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const status = busy
    ? "正在重新编号…"
    : hasResult
      ? output === input
        ? "编号无需调整"
        : "已生成排序结果"
      : "待排序";

  return (
    <ToolboxPageTemplate
      toolName="Protobuf 排序工具"
      description="为字段重新编号，左右对照检查每一处变化。"
      toolIcon="mdi:sort-alphabetical-ascending"
      actions={
        <>
          <Button
            color="primary"
            isDisabled={busy || !input.trim()}
            onPress={() => void sort()}
          >
            <ListOrdered />
            重新排序编号
          </Button>
          <Button
            variant="outline"
            onPress={() => {
              updateInput(example);
              editor.current?.focus();
            }}
          >
            <RotateCcw />
            载入示例
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              updateInput("");
              clearResult();
            }}
          >
            <Trash2 />
            清空
          </Button>
        </>
      }
      statusIndicator={
        <div className="flex items-center gap-3">
          <span role="status" aria-live="polite">
            {status}
          </span>
          <span
            ref={setSettingsTarget}
            className="flex shrink-0 items-center"
          />
        </div>
      }
    >
      <details className="tool-examples">
        <summary>编号规则 · 从 1 开始，跳过保留范围</summary>
        <p className="text-muted-foreground">
          每个 message 从 1 开始编号，oneof 共用序列，嵌套 message
          独立编号，跳过保留范围。
        </p>
      </details>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          排序失败：{error}
        </p>
      )}
      <section aria-label="排序前后差异" className="tool-panel flex-1">
        <div className="tool-diff-labels">
          <div>
            <span>排序前</span>
            <span className="text-muted-foreground">可编辑</span>
          </div>
          <div>
            <span>排序后</span>
            <span className="text-muted-foreground">只读</span>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <MonacoDiffEditor
            ref={editor}
            tabKey="proto-sort"
            tabTitle="Protobuf 排序工具"
            originalValue={input}
            modifiedValue={hasResult ? output : input}
            onUpdateOriginalValue={updateInput}
            language="proto"
            languageMode="manual"
            modifiedReadOnly
            useInlineViewWhenSpaceIsLimited={false}
            originalAriaLabel="排序前"
            modifiedAriaLabel="排序后"
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
            settingsBarTarget={settingsTarget}
            languageBarTarget={null}
            showTimestampDecorators={false}
            showBase64Decorators={false}
            showUnicodeDecorators={false}
            showUrlDecorators={false}
            showImageDecorators={false}
          />
        </div>
      </section>
    </ToolboxPageTemplate>
  );
}
