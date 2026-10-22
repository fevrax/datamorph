import { writeClipboardText } from "@/utils/clipboard";
import { useBackgroundTask } from "@/components/workspace/useBackgroundTask";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import { useRef, useState } from "react";
import { Button, Card, CardBody, Tooltip } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "next-themes";

import toast from "@/utils/toast";
import MonacoEditor, {
  MonacoDataEditorRef,
} from "@/components/monacoEditor/MonacoDataEditor.tsx";
import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";
import {
  KeyNamingCollisionError,
  type KeyNamingCollision,
  type NamingFormat,
} from "@/utils/keyNamingConverter";

const FORMAT_OPTIONS: {
  format: NamingFormat;
  label: string;
  displayText: string;
  example: string;
  icon: string;
  inactiveBg: string;
  inactiveBorder: string;
  inactiveHoverBg: string;
  inactiveHoverBorder: string;
  inactiveIconColor: string;
  activeBg: string;
  activeBorder: string;
  activeShadow: string;
}[] = [
  {
    format: "camel",
    label: "小驼峰",
    displayText: "转小驼峰",
    example: "firstName",
    icon: "solar:arrow-right-linear",
    inactiveBg: "bg-accent dark:bg-accent/30",
    inactiveBorder: "border-accent dark:border-accent/40",
    inactiveHoverBg: "hover:bg-accent dark:hover:bg-accent/40",
    inactiveHoverBorder: "hover:border-primary dark:hover:border-primary/60",
    inactiveIconColor: "text-primary",
    activeBg: "bg-gradient-to-br from-primary to-primary",
    activeBorder: "border-primary",
    activeShadow: "shadow-primary/50 dark:shadow-accent/50",
  },
  {
    format: "pascal",
    label: "大驼峰",
    displayText: "转大驼峰",
    example: "FirstName",
    icon: "solar:arrow-right-linear",
    inactiveBg: "bg-secondary dark:bg-secondary/30",
    inactiveBorder: "border-secondary dark:border-secondary/40",
    inactiveHoverBg: "hover:bg-secondary dark:hover:bg-secondary/40",
    inactiveHoverBorder:
      "hover:border-secondary dark:hover:border-secondary/60",
    inactiveIconColor: "text-secondary",
    activeBg: "bg-gradient-to-br from-secondary to-secondary",
    activeBorder: "border-secondary",
    activeShadow: "shadow-secondary/50 dark:shadow-secondary/50",
  },
  {
    format: "snake",
    label: "小写+下划线",
    displayText: "转下划线",
    example: "first_name",
    icon: "solar:arrow-right-linear",
    inactiveBg: "bg-success dark:bg-success/30",
    inactiveBorder: "border-success dark:border-success/40",
    inactiveHoverBg: "hover:bg-success dark:hover:bg-success/40",
    inactiveHoverBorder: "hover:border-success dark:hover:border-success/60",
    inactiveIconColor: "text-success",
    activeBg: "bg-gradient-to-br from-success to-success",
    activeBorder: "border-success",
    activeShadow: "shadow-success/50 dark:shadow-success/50",
  },
  {
    format: "kebab",
    label: "短横线",
    displayText: "转短横线",
    example: "first-name",
    icon: "solar:arrow-right-linear",
    inactiveBg: "bg-warning dark:bg-warning/30",
    inactiveBorder: "border-warning dark:border-warning/40",
    inactiveHoverBg: "hover:bg-warning dark:hover:bg-warning/40",
    inactiveHoverBorder: "hover:border-warning dark:hover:border-warning/60",
    inactiveIconColor: "text-warning",
    activeBg: "bg-gradient-to-br from-warning to-warning",
    activeBorder: "border-warning",
    activeShadow: "shadow-warning/50 dark:shadow-warning/50",
  },
  {
    format: "constant",
    label: "大写+下划线",
    displayText: "转常量",
    example: "FIRST_NAME",
    icon: "solar:arrow-right-linear",
    inactiveBg: "bg-destructive dark:bg-destructive/30",
    inactiveBorder: "border-destructive dark:border-destructive/40",
    inactiveHoverBg: "hover:bg-destructive dark:hover:bg-destructive/40",
    inactiveHoverBorder:
      "hover:border-destructive dark:hover:border-destructive/60",
    inactiveIconColor: "text-destructive",
    activeBg: "bg-gradient-to-br from-destructive to-destructive",
    activeBorder: "border-destructive",
    activeShadow: "shadow-destructive/50 dark:shadow-destructive/50",
  },
];

const useToolState = createToolStateHook("jsonKeyNaming");

export default function JsonKeyNamingPage() {
  const { resolvedTheme: theme } = useTheme();
  const inputEditorRef = useRef<MonacoDataEditorRef>(null);
  const outputEditorRef = useRef<MonacoDataEditorRef>(null);

  const [inputValue, setInputValue] = useToolState("inputValue", "");
  const [outputValue, setOutputValue] = useToolState("outputValue", "");
  const [activeFormat, setActiveFormat] = useToolState("activeFormat", null);
  const [collisions, setCollisions] = useState<KeyNamingCollision[]>([]);

  const task = useBackgroundTask(inputValue);
  const clearConversionResult = () => {
    setOutputValue("");
    outputEditorRef.current?.updateValue("");
    setActiveFormat(null);
  };

  const handleConvert = async (format: NamingFormat) => {
    if (!inputValue.trim()) {
      toast.warning("请先输入 JSON 内容");

      return;
    }

    try {
      const result =
        (await task.run({ action: "keys", content: inputValue, format }))
          .content || "";

      setOutputValue(result);
      outputEditorRef.current?.updateValue(result);
      setActiveFormat(format);
      setCollisions([]);
      toast.success(
        `已转换为${FORMAT_OPTIONS.find((f) => f.format === format)?.label}`,
      );
    } catch (error) {
      const e = error as KeyNamingCollisionError;
      if (e.name === "AbortError") return;
      clearConversionResult();

      if (e.name === "KeyNamingCollisionError") {
        setCollisions(e.collisions);
        const first = e.collisions[0];

        toast.error(
          "字段命名冲突，已中止转换",
          `${first.path}: ${first.sourceKeys.join("、")} → ${first.targetKey}`,
        );

        return;
      }

      setCollisions([]);
      toast.error(`JSON 解析失败: ${(e as Error).message}`);
    }
  };

  const handleReset = () => {
    setInputValue("");
    setOutputValue("");
    setActiveFormat(null);
    setCollisions([]);
    inputEditorRef.current?.updateValue("");
    outputEditorRef.current?.updateValue("");
    toast.success("内容已清空");
  };

  const copyToClipboard = (text: string) => {
    if (!text) {
      toast.warning("暂无内容可复制");

      return;
    }

    writeClipboardText(text)
      .then(() => toast.success("已复制到剪贴板"))
      .catch(() => toast.error("复制失败"));
  };

  return (
    <ToolboxPageTemplate
      toolIcon="solar:text-selection-bold"
      toolIconColor="text-primary"
      toolName="JSON 字段命名转换"
    >
      <div className="key-naming-layout flex flex-1 min-h-0 overflow-hidden gap-2">
        {/* 左侧输入编辑器 */}
        <Card className="flex-1 h-full overflow-hidden shadow-md border border-border m-2 mr-0">
          <CardBody className="p-0 h-full flex flex-col">
            <div className="tool-editor-header bg-muted border-b border-border flex shrink-0 justify-between items-center">
              <span className="text-sm font-medium flex items-center gap-2">
                <Icon
                  className="text-muted-foreground"
                  icon="solar:document-text-outline"
                  width={16}
                />
                输入 JSON
              </span>
              <div className="flex items-center gap-1">
                <Tooltip content="格式化" placement="top">
                  <Button
                    isIconOnly
                    aria-label="格式化"
                    className="bg-secondary/50 hover:bg-border/60"
                    size="sm"
                    variant="light"
                    onPress={() => inputEditorRef.current?.format()}
                  >
                    <Icon
                      className="text-muted-foreground"
                      icon="solar:magic-stick-linear"
                      width={18}
                    />
                  </Button>
                </Tooltip>
                <Tooltip content="复制" placement="top">
                  <Button
                    isIconOnly
                    aria-label="复制输入"
                    className="bg-secondary/50 hover:bg-border/60"
                    size="sm"
                    variant="light"
                    onPress={() => copyToClipboard(inputValue)}
                  >
                    <Icon
                      className="text-muted-foreground"
                      icon="solar:copy-outline"
                      width={18}
                    />
                  </Button>
                </Tooltip>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0 overflow-hidden">
              <MonacoEditor
                ref={inputEditorRef}
                height="100%"
                language="json"
                tabKey="keyNamingInput"
                theme={theme === "dark" ? "vs-dark" : "vs-light"}
                value={inputValue}
                onUpdateValue={(value) => setInputValue(value || "")}
              />
            </div>
          </CardBody>
        </Card>

        {/* 中间按钮列 */}
        <div className="key-naming-actions flex flex-col items-center justify-center gap-2 w-36 shrink-0 px-1 py-2 overflow-y-auto">
          {FORMAT_OPTIONS.map(
            ({
              format,
              displayText,
              example,
              inactiveBg,
              inactiveBorder,
              inactiveHoverBg,
              inactiveHoverBorder,
              inactiveIconColor,
              activeBg,
              activeBorder,
              activeShadow,
            }) => {
              const isActive = activeFormat === format;

              return (
                <button
                  key={format}
                  className={`group w-full rounded-xl px-3 py-2.5 text-sm font-medium border
                  transition-all duration-200 ease-out
                  active:scale-[0.97]
                  ${
                    isActive
                      ? `${activeBg} ${activeBorder} text-white shadow-lg ${activeShadow} scale-[1.02]`
                      : `${inactiveBg} ${inactiveBorder} ${inactiveHoverBg} ${inactiveHoverBorder} text-foreground dark:text-input hover:shadow-md hover:scale-[1.02]`
                  }`}
                  type="button"
                  onClick={() => handleConvert(format)}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Icon
                      className={`transition-transform duration-200 group-hover:translate-x-0.5 ${
                        isActive ? "text-white/90" : inactiveIconColor
                      }`}
                      icon="solar:arrow-right-linear"
                      width={14}
                    />
                    {displayText}
                  </span>
                  <span
                    className={`block text-xs mt-0.5 font-mono transition-colors duration-200 ${
                      isActive ? "text-white/60" : "text-muted-foreground"
                    }`}
                  >
                    {example}
                  </span>
                </button>
              );
            },
          )}
          <button
            className="group w-full rounded-xl px-3 py-2 text-sm font-medium
              bg-transparent border border-border dark:border-foreground
              hover:bg-destructive dark:hover:bg-destructive/30
              hover:border-destructive dark:hover:border-destructive/40
              text-muted-foreground hover:text-danger
              transition-all duration-200 ease-out
              active:scale-[0.97] hover:scale-[1.02]"
            type="button"
            onClick={handleReset}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Icon
                className="transition-transform duration-200 group-hover:rotate-45 text-muted-foreground group-hover:text-danger"
                icon="solar:restart-linear"
                width={14}
              />
              重置
            </span>
          </button>
        </div>

        {/* 右侧输出编辑器 */}
        <Card className="flex-1 h-full overflow-hidden shadow-md border border-border m-2 ml-0">
          <CardBody className="p-0 h-full flex flex-col">
            <div className="tool-editor-header bg-muted border-b border-border flex shrink-0 justify-between items-center">
              <span className="text-sm font-medium flex items-center gap-2">
                <Icon
                  className="text-muted-foreground"
                  icon="solar:code-square-linear"
                  width={16}
                />
                输出 JSON
              </span>
              <div className="flex items-center gap-1">
                <Tooltip content="格式化" placement="top">
                  <Button
                    isIconOnly
                    aria-label="格式化输出"
                    className="bg-secondary/50 hover:bg-border/60"
                    size="sm"
                    variant="light"
                    onPress={() => outputEditorRef.current?.format()}
                  >
                    <Icon
                      className="text-muted-foreground"
                      icon="solar:magic-stick-linear"
                      width={18}
                    />
                  </Button>
                </Tooltip>
                <Tooltip content="复制" placement="top">
                  <Button
                    isIconOnly
                    aria-label="复制输出"
                    className="bg-secondary/50 hover:bg-border/60"
                    size="sm"
                    variant="light"
                    onPress={() => copyToClipboard(outputValue)}
                  >
                    <Icon
                      className="text-muted-foreground"
                      icon="solar:copy-outline"
                      width={18}
                    />
                  </Button>
                </Tooltip>
              </div>
            </div>
            {collisions.length > 0 && (
              <div className="max-h-36 overflow-y-auto border-b border-destructive bg-destructive px-3 py-2 text-xs text-destructive dark:border-destructive/60 dark:bg-destructive/30 dark:text-destructive">
                <div className="mb-1 font-medium">
                  检测到 {collisions.length} 处字段命名冲突，未生成转换结果：
                </div>
                <ul className="space-y-1 font-mono">
                  {collisions.map(({ path, sourceKeys, targetKey }) => (
                    <li key={`${path}:${targetKey}`}>
                      {path}:{" "}
                      {sourceKeys.map((key) => JSON.stringify(key)).join("、")}
                      {" → "}
                      {JSON.stringify(targetKey)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex-1 w-full min-h-0 overflow-hidden">
              <MonacoEditor
                ref={outputEditorRef}
                height="100%"
                language="json"
                tabKey="keyNamingOutput"
                theme={theme === "dark" ? "vs-dark" : "vs-light"}
                value={outputValue}
                onUpdateValue={(value) => setOutputValue(value || "")}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </ToolboxPageTemplate>
  );
}
