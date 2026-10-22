import { writeClipboardText } from "@/utils/clipboard";
import { useToolAI } from "@/components/workspace/useToolAI";
import { useBackgroundTask } from "@/components/workspace/useBackgroundTask";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import { useRef, useState, useEffect } from "react";
import { Button, Spinner, Select, SelectItem } from "@/components/ui";
import { useTheme } from "next-themes";

import toast from "@/utils/toast";
import MonacoEditor, {
  MonacoDataEditorRef,
} from "@/components/monacoEditor/MonacoDataEditor.tsx";
import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";
import ToolPanel from "@/components/toolbox/ToolPanel";
import {
  ArrowRight,
  ArrowLeftRight,
  Copy,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import AIPromptOverlay, {
  QuickPrompt,
} from "@/components/ai/AIPromptOverlay.tsx";
import { useOpenAIConfigStore } from "@/store/useOpenAIConfigStore";

import { openAIService } from "@/services/openAIService";

// 支持的数据格式
const DATA_FORMATS = [
  { value: "json", label: "JSON", icon: "vscode-icons:file-type-json" },
  { value: "json5", label: "JSON5", icon: "vscode-icons:file-type-json" },
  { value: "yaml", label: "YAML", icon: "vscode-icons:file-type-yaml" },
  { value: "xml", label: "XML", icon: "vscode-icons:file-type-xml" },
  { value: "toml", label: "TOML", icon: "vscode-icons:file-type-toml" },
];

// 为AI转换定义快捷指令
const quickPrompts: QuickPrompt[] = [
  {
    id: "convert_json_to_csv",
    label: "JSON转CSV",
    icon: "material-symbols:csv-outline",
    prompt: "请将这个JSON数据转换为CSV格式，保持结构和数据不变",
    color: "primary",
  },
];

const useToolState = createToolStateHook("dataFormatConverter");

export default function DataFormatConverterPage() {
  const { resolvedTheme: theme } = useTheme();

  // 编辑器引用
  const inputEditorRef = useRef<MonacoDataEditorRef>(null);
  const outputEditorRef = useRef<MonacoDataEditorRef>(null);

  // 状态管理
  const [inputValue, setInputValue] = useToolState("inputValue", "");
  const [outputValue, setOutputValue] = useToolState("outputValue", "");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>("");

  // 数据格式转换相关状态
  const [inputFormat, setInputFormat] = useToolState("inputFormat", "json");
  const [outputFormat, setOutputFormat] = useToolState("outputFormat", "yaml");

  const task = useBackgroundTask(
    inputValue + "\u0000" + inputFormat + outputFormat,
  );
  const ai = useToolAI(inputValue + "\u0000" + inputFormat + outputFormat);

  // 处理快捷指令点击
  const handleQuickPromptClick = (quickPrompt: QuickPrompt) => {
    setPrompt(quickPrompt.prompt);
    setIsAiModalOpen(true);
  };

  // 使用 OpenAI 配置 store
  const { syncConfig } = useOpenAIConfigStore();

  // 初始化时同步配置
  useEffect(() => {
    syncConfig();
    openAIService.syncConfig();
  }, [syncConfig]);

  // 重置函数
  const handleReset = () => {
    setInputValue("");
    setOutputValue("");
    outputEditorRef.current?.updateValue("");
    inputEditorRef.current?.updateValue("");
    toast.success("内容已清空");
  };

  // 交换输入和输出格式
  const handleSwapFormats = () => {
    setInputFormat(outputFormat);
    setOutputFormat(inputFormat);

    if (outputValue) {
      setInputValue(outputValue);
      setOutputValue("");
    }
  };

  // 数据格式转换函数
  const convertDataFormat = async () => {
    if (!inputValue) {
      toast.warning("请先输入内容");

      return;
    }

    setIsProcessing(true);
    setProcessingStep("正在处理转换...");

    try {
      const result =
        (
          await task.run({
            action: "convert",
            content: inputValue,
            from: inputFormat,
            to: outputFormat,
          })
        ).content || "";

      // 更新输出
      setOutputValue(result);
      outputEditorRef.current?.updateValue(result);

      toast.success("转换成功");
      setProcessingStep("转换完成");
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("转换错误:", error);
      toast.error(`转换失败: ${(error as Error).message}`);
      setProcessingStep("");
    } finally {
      setIsProcessing(false);
    }
  };

  // 复制输出内容
  const copyOutput = () => {
    if (!outputValue) {
      toast.warning("暂无内容可复制");

      return;
    }

    if (navigator.clipboard || (window as any).utools) {
      writeClipboardText(outputValue)
        .then(() => toast.success("已复制到剪贴板"))
        .catch(() => toast.error("复制失败"));
    } else {
      toast.error("复制失败");
    }
  };

  // 复制输入内容
  const copyInput = () => {
    if (!inputValue) {
      toast.warning("暂无内容可复制");

      return;
    }
    if (navigator.clipboard || (window as any).utools) {
      writeClipboardText(inputValue)
        .then(() => toast.success("已复制到剪贴板"))
        .catch(() => toast.error("复制失败"));
    } else {
      toast.error("复制失败");
    }
  };

  // 输入、输出格式化使用与转换相同的无损解析/序列化路径。
  const formatContent = async (side: "input" | "output") => {
    const value = side === "input" ? inputValue : outputValue;
    const format = side === "input" ? inputFormat : outputFormat;

    if (!value) {
      toast.warning("暂无内容可格式化");

      return;
    }

    try {
      const formatted =
        (
          await task.run({
            action: "convert",
            content: value,
            from: format,
            to: format,
          })
        ).content || "";

      if (side === "input") {
        setInputValue(formatted);
        inputEditorRef.current?.updateValue(formatted);
      } else {
        setOutputValue(formatted);
        outputEditorRef.current?.updateValue(formatted);
      }
      toast.success("格式化成功");
    } catch (error) {
      toast.error(`格式化失败: ${(error as Error).message}`);
    }
  };
  const formatInput = () => formatContent("input");
  const formatOutput = () => formatContent("output");

  // AI 转换处理函数
  const handleAiConvert = async () => {
    if (!inputValue) {
      toast.warning("请先输入内容");

      return;
    }

    if (!prompt) {
      toast.warning("请输入转换需求");

      return;
    }

    setIsAiModalOpen(false);
    setIsAiProcessing(true);
    setProcessingStep("正在处理转换...");

    try {
      // 构建提示词
      const promptText = `${prompt}\n以下是${DATA_FORMATS.find((f) => f.value === inputFormat)?.label || inputFormat}内容：\n\`\`\`${inputFormat}\n${inputValue}\n\`\`\`\n请仅返回转换后的代码并使用\`\`\`语言标记\`\`\`包裹，不要包含任何解释或其他内容。`;

      if (promptText.length > openAIService.maxTokens) {
        toast.error("内容超出限制，请缩短内容或使用其他方式描述需求。");
        setProcessingStep("");
        setIsAiProcessing(false);

        return;
      }

      // 使用 OpenAI 服务
      await ai.run([{ role: "user", content: promptText }], {
        onStart: () => {
          setProcessingStep("正在生成...");
        },
        onProcessing: (step) => {
          setProcessingStep(step);
        },
        onChunk: (_, accumulated) => {
          outputEditorRef.current?.updateValue(accumulated);
        },
        onComplete: (final) => {
          // 提取语言标记
          const langMatch = final.match(/^```([a-z0-9+#]+)\s/i);
          let detectedLang = langMatch
            ? langMatch[1].toLowerCase()
            : outputFormat;

          // 更好地映射常见语言标记到编辑器支持的语言
          switch (detectedLang) {
            case "typescript":
            case "ts":
              detectedLang = "typescript";
              break;
            case "javascript":
            case "js":
              detectedLang = "javascript";
              break;
            case "golang":
            case "go":
              detectedLang = "go";
              break;
            case "java":
              detectedLang = "java";
              break;
            case "csharp":
            case "c#":
              detectedLang = "csharp";
              break;
            case "python":
            case "py":
              detectedLang = "python";
              break;
            case "yaml":
            case "yml":
              detectedLang = "yaml";
              break;
            case "jsonschema":
            case "json-schema":
              detectedLang = "json";
              break;
            case "json5":
              detectedLang = "json5";
              break;
            default:
              // 检查是否是输出格式中的一种
              if (!DATA_FORMATS.some((f) => f.value === detectedLang)) {
                detectedLang = outputFormat;
              }
              break;
          }

          // 清理结果，移除 markdown 格式标记
          const cleanedResult = final
            .replace(/^```[a-z0-9+#]*\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          try {
            // 更新编辑器语言和内容
            outputEditorRef.current?.updateValue(cleanedResult);
            outputEditorRef.current?.setLanguage(detectedLang);
            setOutputFormat(
              DATA_FORMATS.some((f) => f.value === detectedLang)
                ? detectedLang
                : outputFormat,
            );
            setOutputValue(cleanedResult);
            toast.success("转换成功");
            setProcessingStep("转换完成");
          } catch (formatError) {
            console.error("格式更新错误:", formatError);
            // 即使格式设置失败，也展示内容
            outputEditorRef.current?.updateValue(cleanedResult);
            setOutputValue(cleanedResult);
            toast.success("内容已生成，但格式设置失败");
            setProcessingStep("转换部分完成");
          }
        },
        onError: (error) => {
          console.error("AI转换错误:", error);
          toast.error(`转换失败: ${error.message || "未知错误"}`);
          setProcessingStep("");
        },
      });
    } catch (error) {
      console.error("AI转换错误:", error);
      toast.error(
        `转换失败: ${(error as Error).message || "未知错误，请重试"}`,
      );
      setProcessingStep("转换失败");
    } finally {
      setIsAiProcessing(false);
      setIsAiModalOpen(false);
      setPrompt("");
    }
  };

  const busy = isProcessing || isAiProcessing;
  return (
    <ToolboxPageTemplate
      toolIcon="token-branded:swap"
      toolName="数据格式转换"
      description="选择输入与输出格式，在中央完成转换。"
    >
      <div className="tool-editor-workspace">
        <AIPromptOverlay
          isOpen={isAiModalOpen}
          placeholderText="描述需要转换的格式或结构…"
          prompt={prompt}
          quickPrompts={quickPrompts}
          tipText="支持自定义数据结构和代码生成需求"
          onClose={() => setIsAiModalOpen(false)}
          onPromptChange={setPrompt}
          onQuickPromptClick={handleQuickPromptClick}
          onSubmit={handleAiConvert}
        />
        <div className="tool-conversion-layout">
          <ToolPanel
            title={`输入 · ${inputFormat.toUpperCase()}`}
            actions={
              <>
                <Button size="sm" variant="ghost" onPress={formatInput}>
                  格式化
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="复制输入"
                  onPress={copyInput}
                >
                  <Copy />
                </Button>
              </>
            }
          >
            <MonacoEditor
              ref={inputEditorRef}
              language={inputFormat}
              tabKey="input"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              value={inputValue}
              onUpdateValue={(value) => setInputValue(value || "")}
            />
          </ToolPanel>
          <aside className="tool-conversion-controls" aria-label="格式转换设置">
            <div>
              <span className="tool-field-label">输入格式</span>
              <Select
                aria-label="输入格式"
                selectedKeys={[inputFormat]}
                size="sm"
                onChange={(event) => {
                  setInputFormat(event.target.value);
                  inputEditorRef.current?.setLanguage(event.target.value);
                }}
              >
                {DATA_FORMATS.map((format) => (
                  <SelectItem key={format.value}>{format.label}</SelectItem>
                ))}
              </Select>
            </div>
            <ArrowRight
              className="tool-conversion-arrow size-4"
              aria-hidden="true"
            />
            <div>
              <span className="tool-field-label">输出格式</span>
              <Select
                aria-label="输出格式"
                selectedKeys={[outputFormat]}
                size="sm"
                onChange={(event) => {
                  setOutputFormat(event.target.value);
                  outputEditorRef.current?.setLanguage(event.target.value);
                }}
              >
                {DATA_FORMATS.map((format) => (
                  <SelectItem key={format.value}>{format.label}</SelectItem>
                ))}
              </Select>
            </div>
            <Button
              color="primary"
              size="sm"
              isDisabled={busy || !inputValue}
              onPress={convertDataFormat}
            >
              {isProcessing ? <Spinner size="sm" /> : <ArrowRight />}转换格式
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={busy}
              onPress={handleSwapFormats}
            >
              <ArrowLeftRight />
              交换格式
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={busy}
              onPress={() => setIsAiModalOpen(true)}
            >
              {isAiProcessing ? <Spinner size="sm" /> : <WandSparkles />}AI 转换
            </Button>
            <Button
              variant="ghost"
              size="sm"
              isDisabled={busy}
              onPress={handleReset}
            >
              <RotateCcw />
              重置
            </Button>
            <span
              role="status"
              aria-live="polite"
              className="tool-workspace-status"
            >
              {processingStep}
            </span>
          </aside>
          <ToolPanel
            title={`输出 · ${outputFormat.toUpperCase()}`}
            actions={
              <>
                <Button size="sm" variant="ghost" onPress={formatOutput}>
                  格式化
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="复制输出"
                  onPress={copyOutput}
                >
                  <Copy />
                </Button>
              </>
            }
          >
            <MonacoEditor
              ref={outputEditorRef}
              language={outputFormat}
              tabKey="out"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              value={outputValue}
              onUpdateValue={(value) => setOutputValue(value || "")}
            />
          </ToolPanel>
        </div>
      </div>
    </ToolboxPageTemplate>
  );
}
