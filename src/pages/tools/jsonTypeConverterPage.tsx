import { writeClipboardText } from "@/utils/clipboard";
import { useToolAI } from "@/components/workspace/useToolAI";
import { useBackgroundTask } from "@/components/workspace/useBackgroundTask";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import { useRef, useState, useEffect } from "react";
import { Button, Spinner, Select, SelectItem } from "@/components/ui";
import { Code2, Copy, RotateCcw, WandSparkles } from "lucide-react";
import ToolPanel from "@/components/toolbox/ToolPanel";
import { useTheme } from "next-themes";

import toast from "@/utils/toast";
import MonacoEditor, {
  MonacoDataEditorRef,
} from "@/components/monacoEditor/MonacoDataEditor.tsx";
import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";
import ResizableEditorLayout from "@/components/layout/ResizableEditorLayout.tsx";
import AIPromptOverlay, {
  QuickPrompt,
} from "@/components/ai/AIPromptOverlay.tsx";
import { useOpenAIConfigStore } from "@/store/useOpenAIConfigStore";
import { openAIService } from "@/services/openAIService";

// 支持的目标语言列表
const TARGET_LANGUAGES = [
  { value: "go", label: "Go", icon: "devicon:go" },
  { value: "typescript", label: "TypeScript", icon: "devicon:typescript" },
  { value: "javascript", label: "JavaScript", icon: "devicon:javascript" },
  { value: "java", label: "Java", icon: "devicon:java" },
  { value: "csharp", label: "C#", icon: "devicon:csharp" },
  { value: "python", label: "Python", icon: "devicon:python" },
  { value: "swift", label: "Swift", icon: "devicon:swift" },
  { value: "kotlin", label: "Kotlin", icon: "devicon:kotlin" },
  { value: "dart", label: "Dart", icon: "devicon:dart" },
  { value: "ruby", label: "Ruby", icon: "devicon:ruby" },
  { value: "rust", label: "Rust", icon: "devicon:rust" },
  { value: "php", label: "PHP", icon: "devicon:php" },
  {
    value: "plaintext",
    label: "JSON Schema（纯文本）",
    icon: "weui:text-filled",
  },
];

// 为AI转换定义快捷指令
const quickPrompts: QuickPrompt[] = [
  {
    id: "convert_to_typescript",
    label: "转换为TS接口",
    icon: "simple-icons:typescript",
    prompt: "请将这个JSON转换为TypeScript接口定义，添加适当的注释",
    color: "primary",
  },
  {
    id: "convert_to_go",
    label: "转换为Go结构体",
    icon: "simple-icons:go",
    prompt: "请将这个JSON转换为Go语言结构体，包含json和form标签，添加中文注释",
    color: "secondary",
  },
  {
    id: "convert_to_java",
    label: "转换为Java类",
    icon: "logos:java",
    prompt: "请将这个JSON转换为Java POJO类，添加Jackson注解和Lombok支持",
    color: "success",
  },
  {
    id: "convert_to_python",
    label: "转换为Python类",
    icon: "simple-icons:python",
    prompt: "请将这个JSON转换为Python的Pydantic模型，添加字段验证和中文描述",
    color: "warning",
  },
  {
    id: "convert_to_csharp",
    label: "转换为C#类",
    icon: "simple-icons:csharp",
    prompt: "请将这个JSON转换为C#类，使用属性和Newtonsoft.Json注解",
    color: "primary",
  },
  {
    id: "convert_to_rust",
    label: "转换为Rust结构体",
    icon: "simple-icons:rust",
    prompt: "请将这个JSON转换为Rust结构体，添加serde注解和类型注释",
    color: "danger",
  },
  {
    id: "convert_to_swift",
    label: "转换为Swift结构",
    icon: "simple-icons:swift",
    prompt: "请将这个JSON转换为Swift结构体，实现Codable协议",
    color: "success",
  },
  {
    id: "convert_to_kotlin",
    label: "转换为Kotlin类",
    icon: "simple-icons:kotlin",
    prompt: "请将这个JSON转换为Kotlin数据类，添加序列化注解",
    color: "secondary",
  },
  {
    id: "convert_to_dart",
    label: "转换为Dart类",
    icon: "simple-icons:dart",
    prompt:
      "请将这个JSON转换为Dart类，使用json_serializable进行序列化，添加适当的类型注解",
    color: "warning",
  },
  {
    id: "generate_graphql",
    label: "生成GraphQL Schema",
    icon: "simple-icons:graphql",
    prompt: "根据这个JSON生成一个完整的GraphQL Schema定义",
    color: "default",
  },
  {
    id: "generate_db_schema",
    label: "生成数据库模型",
    icon: "solar:database-outline",
    prompt: "根据这个JSON生成MySQL表结构定义和ORM模型",
    color: "warning",
  },
];

const useToolState = createToolStateHook("jsonTypeConverter");

export default function JsonTypeConverterPage() {
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

  // 选择的目标语言
  const [targetLanguage, setTargetLanguage] = useToolState(
    "targetLanguage",
    "typescript",
  );

  const task = useBackgroundTask(inputValue + "\u0000" + targetLanguage);
  const ai = useToolAI(inputValue + "\u0000" + targetLanguage);

  // 使用 OpenAI 配置 store
  const { syncConfig } = useOpenAIConfigStore();

  // 初始化时同步配置
  useEffect(() => {
    syncConfig();
    // 同时也同步OpenAI服务的配置
    openAIService.syncConfig();
  }, [syncConfig]);

  // 重置函数
  const handleReset = () => {
    inputEditorRef.current?.updateValue("");
    outputEditorRef.current?.updateValue("");
    setInputValue("");
    setOutputValue("");
    toast.success("内容已清空");
  };

  // 使用quicktype进行类型转换
  const convertJsonToType = async () => {
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
            action: "type",
            content: inputValue,
            language: targetLanguage,
          })
        ).content || "";

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

    writeClipboardText(outputValue)
      .then(() => toast.success("已复制到剪贴板"))
      .catch(() => toast.error("复制失败"));
  };

  // AI 转换处理函数
  const handleAiConvert = async () => {
    if (!inputValue) {
      toast.warning("请先输入 JSON 内容");

      return;
    }

    if (!prompt) {
      toast.warning("请输入转换需求");

      return;
    }

    setIsAiProcessing(true);
    setProcessingStep("正在处理转换...");

    try {
      // 构建提示词
      const promptText = `${prompt}\n以下是 JSON 内容：\n\`\`\`json\n${inputValue}\n\`\`\`\n请仅返回转换后的代码并使用\`\`\`语言标记\`\`\`包裹，不要包含任何解释或其他内容。`;

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
          // // 清理结果，移除 markdown 格式标记
          // const cleanedResult = accumulated
          //   .replace(/^```[a-z]*\s*/i, "")
          //   .replace(/```\s*$/i, "")
          //   .trim();

          outputEditorRef.current?.updateValue(accumulated);
        },
        onComplete: (final) => {
          // 提取语言标记
          const langMatch = final.match(/^```([a-z]+)\s/i);
          let detectedLang = langMatch
            ? langMatch[1].toLowerCase()
            : targetLanguage;

          if (!detectedLang) {
            detectedLang = "plaintext";
          }
          console.log("Detected language:", detectedLang);
          // 清理结果，移除 markdown 格式标记
          const cleanedResult = final
            .replace(/^```[a-z]*\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          // 更新编辑器语言和内容
          outputEditorRef.current?.setLanguage(detectedLang);
          outputEditorRef.current?.updateValue(cleanedResult);
          setTargetLanguage(detectedLang);
          setOutputValue(cleanedResult);
          toast.success("转换成功");
          setProcessingStep("转换完成");
        },
        onError: () => {
          setProcessingStep("");
        },
      });
    } catch (error) {
      console.error("AI转换错误:", error);
      toast.error(`转换失败: ${(error as Error).message}`);
    } finally {
      setIsAiProcessing(false);
      setIsAiModalOpen(false);
      setPrompt("");
    }
  };

  // 处理快捷指令点击
  const handleQuickPromptClick = (quickPrompt: QuickPrompt) => {
    setPrompt(quickPrompt.prompt);
    setIsAiModalOpen(true);
  };

  const busy = isProcessing || isAiProcessing;
  return (
    <ToolboxPageTemplate
      toolIcon="fluent-color:code-block-24"
      toolName="JSON 对象类型转换器"
      description="从 JSON 生成类型定义，左右对照源数据与代码。"
      actions={
        <>
          <Button
            color="primary"
            size="sm"
            isDisabled={busy || !inputValue}
            onPress={convertJsonToType}
          >
            {isProcessing ? <Spinner size="sm" /> : <Code2 />}生成类型
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
        </>
      }
      statusIndicator={
        <span role="status" aria-live="polite">
          {processingStep || "JSON → 类型定义"}
        </span>
      }
    >
      <div className="tool-editor-workspace">
        <AIPromptOverlay
          isOpen={isAiModalOpen}
          prompt={prompt}
          placeholderText="例如：生成 Go 结构体，添加 JSON 标签和中文注释"
          quickPrompts={quickPrompts}
          tipText="支持各种语言的类型定义和自定义结构"
          onClose={() => setIsAiModalOpen(false)}
          onPromptChange={setPrompt}
          onQuickPromptClick={handleQuickPromptClick}
          onSubmit={handleAiConvert}
        />
        <ResizableEditorLayout
          initialLeftWidth={50}
          minLeftWidth={30}
          maxLeftWidth={70}
        >
          <ToolPanel
            title="输入 JSON"
            actions={
              <Button
                size="sm"
                variant="ghost"
                onPress={() => inputEditorRef.current?.format()}
              >
                格式化
              </Button>
            }
          >
            <MonacoEditor
              ref={inputEditorRef}
              language="json"
              tabKey="input"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              value={inputValue}
              onUpdateValue={(value) => setInputValue(value || "")}
            />
          </ToolPanel>
          <ToolPanel
            title="输出类型"
            actions={
              <>
                <Select
                  aria-label="目标语言"
                  className="w-40"
                  selectedKeys={[targetLanguage]}
                  size="sm"
                  onChange={(event) => setTargetLanguage(event.target.value)}
                >
                  {TARGET_LANGUAGES.map((language) => (
                    <SelectItem key={language.value}>
                      {language.label}
                    </SelectItem>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="复制结果"
                  isDisabled={!outputValue}
                  onPress={copyOutput}
                >
                  <Copy />
                </Button>
              </>
            }
          >
            <MonacoEditor
              ref={outputEditorRef}
              language={targetLanguage}
              tabKey="out"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              value={outputValue}
              onUpdateValue={(value) => setOutputValue(value || "")}
            />
          </ToolPanel>
        </ResizableEditorLayout>
      </div>
    </ToolboxPageTemplate>
  );
}
