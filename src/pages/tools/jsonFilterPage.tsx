import { useRef } from "react";
import { useTheme } from "next-themes";
import { RotateCcw } from "lucide-react";
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
    <ToolboxPageTemplate
      toolName="JSONPath 查询"
      toolIcon="mdi:filter"
      description="在顶部输入查询，左右对照源数据与匹配结果。"
      actions={
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
      }
      statusIndicator="实时查询 · 结果始终为数组"
    >
      <div className="tool-panel flex-1">
        <MonacoDataEditor
          ref={editor}
          tabKey="jsonpath-playground"
          tabTitle="JSONPath 查询"
          language="json"
          languageMode="manual"
          value={input}
          onUpdateValue={setInput}
          showJsonPathFilter
          queryLayout="console"
          theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
        />
      </div>
      <details className="tool-examples">
        <summary>查询示例与速查 · 点击套用</summary>
        <section className="tool-examples-grid" aria-label="JSONPath 示例">
          {jsonPathExamples.map((example) => (
            <button
              key={example.path}
              onClick={() => editor.current?.setQuery(example.path)}
            >
              <span className="font-medium">{example.title}</span>
              <code>{example.path}</code>
              <span className="mt-1 block text-muted-foreground">
                {example.description}
              </span>
            </button>
          ))}
        </section>
      </details>
    </ToolboxPageTemplate>
  );
}
