import { useToolAI } from "@/components/workspace/useToolAI";
import { useBackgroundTask } from "@/components/workspace/useBackgroundTask";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import { useRef, useState, useEffect } from "react";
import { Button, Spinner } from "@/components/ui";
import { Check, RotateCcw, WandSparkles, Wrench } from "lucide-react";
import { useTheme } from "next-themes";

import toast from "@/utils/toast";
import MonacoDiffEditor, {
  MonacoDiffEditorRef,
} from "@/components/monacoEditor/MonacoDiffEditor.tsx";
import MonacoDiffOperationBar from "@/components/monacoEditor/operationBar/MonacoDiffOperationBar.tsx";
import { MonacoDiffEditorEditorType } from "@/components/monacoEditor/monacoEntity.ts";
import { useOpenAIConfigStore } from "@/store/useOpenAIConfigStore";
import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";
import { openAIService } from "@/services/openAIService.ts";
import { parseJson, stringifyJson } from "@/utils/json";

const useToolState = createToolStateHook("jsonAIRepair");

export default function JsonAIRepairPage() {
  const { resolvedTheme: theme } = useTheme();

  const editorRef = useRef<MonacoDiffEditorRef>(null);
  const [settingsTarget, setSettingsTarget] = useState<HTMLSpanElement | null>(
    null,
  );

  // 使用 OpenAI 配置 store
  const { syncConfig } = useOpenAIConfigStore();

  // 编辑器内容状态
  const [originalValue, setOriginalValue] = useToolState("originalValue", "");
  const [fixedValue, setFixedValue] = useToolState("fixedValue", "");

  // 处理状态
  const [isBasicProcessing, setIsBasicProcessing] = useState<boolean>(false);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>("");

  // 初始化时同步配置
  useEffect(() => {
    syncConfig();
    // 同时也同步OpenAI服务的配置
    openAIService.syncConfig();
  }, [syncConfig]);

  const task = useBackgroundTask(originalValue);
  const ai = useToolAI(originalValue);
  // 基本 JSON 修复函数
  const basicJsonFix = async () => {
    setIsBasicProcessing(true);
    setProcessingStep("正在处理 JSON...");
    try {
      if (originalValue === "") {
        toast.warning("暂无内容");

        return false;
      }
      const repaired =
        (await task.run({ action: "repair", content: originalValue }))
          .content || "";
      setFixedValue(repaired);

      editorRef.current?.updateModifiedValue(repaired);
      toast.success("修复成功");

      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return false;
      console.error("repairJson", e);
      toast.error("修复失败，可能不是有效的 Json 数据");

      return false;
    } finally {
      setIsBasicProcessing(false);
      setProcessingStep("");
    }
  };

  // 使用 OpenAI 库的 AI JSON 修复函数
  const aiJsonFix = async () => {
    setIsAiProcessing(true);
    setIsStreaming(true);
    // 开始时清除已修复的值
    setFixedValue("");
    editorRef.current?.updateModifiedValue("");

    // 验证JSON长度
    if (originalValue.length === 0) {
      toast.warning("暂无内容");
      setIsAiProcessing(false);
      setIsStreaming(false);

      return false;
    } else if (originalValue.length > 10000) {
      toast.warning("内容过长，请缩短后再尝试");
      setIsAiProcessing(false);
      setIsStreaming(false);

      return false;
    }

    // 构建 JSON 修复的提示
    const promptText = `Fix the following invalid JSON and return ONLY the fixed JSON without any explanations or markdown:
\`\`\`json
${originalValue}
\`\`\``;

    if (promptText.length > openAIService.maxTokens) {
      toast.error("内容超出限制，请缩短内容或使用其他方式描述需求。");
      setProcessingStep("");
      setIsAiProcessing(false);

      return;
    }

    // 使用封装的OpenAI服务发送请求
    await ai.run([{ role: "user", content: promptText }], {
      onStart: () => {
        // 已在外部设置了处理状态
      },
      onProcessing: (step) => {
        setProcessingStep(step);
      },
      onChunk: (_, accumulated) => {
        // 清理结果，移除markdown格式标记
        const cleanedJson = accumulated
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();

        // 使用每个块立即更新编辑器
        editorRef.current?.updateModifiedValue(cleanedJson);
      },
      onComplete: (final) => {
        try {
          // 如果存在 markdown 标记则清理
          let finalJson = final
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          // 如果是有效的 JSON 则格式化
          const parsedJson = parseJson(finalJson);
          const formattedJson = stringifyJson(parsedJson, 2);

          editorRef.current?.updateModifiedValue(formattedJson);
          setFixedValue(formattedJson);
        } catch {
          // 如果无法解析最终结果，则保留清理后的版本
          const cleanedJson = final
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          editorRef.current?.updateModifiedValue(cleanedJson);
          setFixedValue(cleanedJson);
          setProcessingStep("修复成功 (有警告)");
        }
      },
      onError: () => {
        // 错误处理已在服务中完成
        setProcessingStep("");
      },
    });

    setIsStreaming(false);
    setIsAiProcessing(false);
  };

  // 重置函数
  const handleReset = () => {
    editorRef.current?.clear(MonacoDiffEditorEditorType.all);
    toast.success("内容已清空");
  };

  // 将修复后的 JSON 应用为新的原始内容
  const applyFixedContent = () => {
    if (fixedValue) {
      editorRef.current?.updateOriginalValue(fixedValue);
      editorRef.current?.updateModifiedValue("");
      toast.success("已应用修复后的内容");
    }
  };

  const busy = isBasicProcessing || isAiProcessing;
  return (
    <ToolboxPageTemplate
      toolIcon="fluent-emoji-flat:magic-wand"
      toolName="JSON AI 修复"
      description="先修复，再对照原文检查，确认后应用结果。"
      actions={
        <>
          <Button
            color="primary"
            size="sm"
            isDisabled={busy || !originalValue}
            onPress={basicJsonFix}
          >
            {isBasicProcessing ? <Spinner size="sm" /> : <Wrench />}自动修复
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={busy || !originalValue}
            onPress={aiJsonFix}
          >
            {isAiProcessing ? <Spinner size="sm" /> : <WandSparkles />}AI 修复
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
          {isStreaming ? "正在生成修复结果…" : processingStep}
        </span>
      }
    >
      <section className="tool-panel flex-1" aria-label="修复前后对照">
        <div className="tool-diff-labels">
          <div>
            <span>原始 JSON</span>
            <span>可编辑</span>
          </div>
          <div>
            <span>修复结果</span>
            <span>审阅后应用</span>
          </div>
        </div>
        <MonacoDiffOperationBar
          onAiClick={() => editorRef.current?.showAiPrompt()}
          onClear={(side) => editorRef.current?.clear(side) === true}
          onCopy={(side) => editorRef.current?.copy(side) === true}
          onFieldSort={(side, sort) =>
            editorRef.current?.fieldSort(side, sort) === true
          }
          onFormat={(side) => editorRef.current?.format(side) === true}
          settingsTargetRef={setSettingsTarget}
        />
        <div className="tool-panel-body">
          <MonacoDiffEditor
            ref={editorRef}
            tabKey="json-fix-tool"
            language="json"
            originalValue={originalValue}
            modifiedValue={fixedValue}
            originalAriaLabel="原始 JSON"
            modifiedAriaLabel="修复结果"
            theme={theme === "dark" ? "vs-dark" : "vs-light"}
            onUpdateOriginalValue={setOriginalValue}
            onUpdateModifiedValue={setFixedValue}
            settingsBarTarget={settingsTarget}
            languageBarTarget={null}
          />
        </div>
      </section>
      <div className="tool-review-footer">
        <span>
          {fixedValue
            ? "检查差异后，将修复结果应用到原文。"
            : "生成修复结果后，可在这里确认并应用。"}
        </span>
        <Button
          color="primary"
          size="sm"
          isDisabled={busy || !fixedValue}
          onPress={applyFixedContent}
        >
          <Check />
          应用修复
        </Button>
      </div>
    </ToolboxPageTemplate>
  );
}
