import { useBackgroundTask } from "@/components/workspace/useBackgroundTask";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import type { editor } from "monaco-editor";

import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Select,
  SelectItem,
  Spinner,
  Switch,
  Tooltip,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "next-themes";

import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";
import ResizableEditorLayout from "@/components/layout/ResizableEditorLayout";
import clipboard from "@/utils/clipboard";
import {
  DEFAULT_ENCODING_OPTIONS,
  getUtf8ByteLength,
  type EncodingOptions,
  type EncodingType,
  type UrlEncodingMode,
} from "@/utils/encodingConverter";

interface EncodingDefinition {
  type: EncodingType;
  label: string;
  description: string;
  icon: string;
}

const TEXT_ENCODING: EncodingDefinition = {
  type: "text",
  label: "纯文本",
  description: "UTF-8 普通文本",
  icon: "solar:text-square-outline",
};

const ENCODINGS: EncodingDefinition[] = [
  {
    type: "base64",
    label: "Base64",
    description: "标准 Base64 编码",
    icon: "ph:binary",
  },
  {
    type: "base64url",
    label: "Base64URL",
    description: "URL-safe Base64 编码",
    icon: "solar:link-round-angle-outline",
  },
  {
    type: "url",
    label: "URL 编码",
    description: "百分号转义编码",
    icon: "solar:link-outline",
  },
  {
    type: "unicode",
    label: "Unicode 转义",
    description: "JavaScript / JSON 转义",
    icon: "solar:global-outline",
  },
  {
    type: "hex",
    label: "Hex",
    description: "十六进制字节",
    icon: "solar:hashtag-outline",
  },
  {
    type: "binary",
    label: "Binary",
    description: "二进制字节",
    icon: "solar:code-square-outline",
  },
];

const ENCODING_MAP = new Map(
  [TEXT_ENCODING, ...ENCODINGS].map((definition) => [
    definition.type,
    definition,
  ]),
);

const cloneDefaultOptions = (): EncodingOptions => ({
  ...DEFAULT_ENCODING_OPTIONS,
});

interface FormatOptionsProps {
  type: EncodingType;
  options: EncodingOptions;
  onChange: (options: EncodingOptions) => void;
}

function FormatOptions({ type, options, onChange }: FormatOptionsProps) {
  const setOption = <Key extends keyof EncodingOptions>(
    key: Key,
    value: EncodingOptions[Key],
  ) => onChange({ ...options, [key]: value });

  return (
    <div>
      <div className="w-full p-3">
        {type === "url" && (
          <Select
            aria-label="URL 编码模式"
            label="处理模式"
            selectedKeys={[options.urlMode]}
            size="sm"
            onChange={(event) =>
              setOption("urlMode", event.target.value as UrlEncodingMode)
            }
          >
            <SelectItem key="component">URL Component</SelectItem>
            <SelectItem key="full">完整 URL</SelectItem>
            <SelectItem key="form">表单模式（空格转 +）</SelectItem>
          </Select>
        )}

        {["base64", "base64url"].includes(type) && (
          <Switch
            className="w-full justify-between"
            isSelected={options.base64Padding}
            size="sm"
            onValueChange={(value) => setOption("base64Padding", value)}
          >
            保留末尾填充
          </Switch>
        )}

        {type === "unicode" && (
          <Switch
            className="w-full justify-between"
            isSelected={options.unicodeEscapeAll}
            size="sm"
            onValueChange={(value) => setOption("unicodeEscapeAll", value)}
          >
            转义全部字符
          </Switch>
        )}

        {type === "hex" && (
          <div className="space-y-3">
            <Select
              aria-label="Hex 分隔方式"
              label="字节分隔"
              selectedKeys={[options.hexSeparator]}
              size="sm"
              onChange={(event) =>
                setOption(
                  "hexSeparator",
                  event.target.value as EncodingOptions["hexSeparator"],
                )
              }
            >
              <SelectItem key="space">空格分隔</SelectItem>
              <SelectItem key="none">紧凑格式</SelectItem>
            </Select>
            <Switch
              className="w-full justify-between"
              isSelected={options.hexUppercase}
              size="sm"
              onValueChange={(value) => setOption("hexUppercase", value)}
            >
              使用大写字母
            </Switch>
            <Switch
              className="w-full justify-between"
              isSelected={options.hexPrefix}
              size="sm"
              onValueChange={(value) => setOption("hexPrefix", value)}
            >
              添加 0x 前缀
            </Switch>
          </div>
        )}

        {type === "binary" && (
          <div className="space-y-3">
            <Select
              aria-label="Binary 分隔方式"
              label="字节分隔"
              selectedKeys={[options.binarySeparator]}
              size="sm"
              onChange={(event) =>
                setOption(
                  "binarySeparator",
                  event.target.value as EncodingOptions["binarySeparator"],
                )
              }
            >
              <SelectItem key="space">空格分隔</SelectItem>
              <SelectItem key="none">紧凑格式</SelectItem>
            </Select>
            <Switch
              className="w-full justify-between"
              isSelected={options.binaryPrefix}
              size="sm"
              onValueChange={(value) => setOption("binaryPrefix", value)}
            >
              添加 0b 前缀
            </Switch>
          </div>
        )}
      </div>
    </div>
  );
}

interface EditorPanelProps {
  title: string;
  footerLabel: string;
  type: EncodingType;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onPaste?: () => void;
  onClear?: () => void;
  onCopy?: () => void;
  onMount?: OnMount;
}

function EditorPanel({
  title,
  footerLabel,
  type,
  value,
  error,
  onChange,
  onPaste,
  onClear,
  onCopy,
  onMount,
}: EditorPanelProps) {
  const { resolvedTheme } = useTheme();
  const definition = ENCODING_MAP.get(type)!;
  const characterCount = Array.from(value).length;
  const byteCount = getUtf8ByteLength(value);

  return (
    <Card className="h-full min-h-0 overflow-hidden border border-border shadow-sm">
      <CardBody className="flex h-full min-h-0 flex-col p-0">
        <div className="tool-panel-header">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="text-primary" icon={definition.icon} width={16} />
            <h2 className="truncate">
              {title}
              <span className="text-muted-foreground font-normal">
                {" · "}
                {definition.label}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip content={`粘贴到${title}`}>
              <Button
                isIconOnly
                aria-label={`粘贴到${title}`}
                size="sm"
                variant="light"
                onPress={onPaste}
              >
                <Icon icon="solar:clipboard-text-outline" width={18} />
              </Button>
            </Tooltip>
            <Tooltip content={`复制${title}`}>
              <Button
                isIconOnly
                aria-label={`复制${title}`}
                isDisabled={!value}
                size="sm"
                variant="light"
                onPress={onCopy}
              >
                <Icon icon="solar:copy-outline" width={18} />
              </Button>
            </Tooltip>
            <Tooltip content={`清空${title}`}>
              <Button
                isIconOnly
                aria-label={`清空${title}`}
                isDisabled={!value}
                size="sm"
                variant="light"
                onPress={onClear}
              >
                <Icon icon="solar:trash-bin-trash-outline" width={18} />
              </Button>
            </Tooltip>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 border-b border-destructive bg-destructive/5 px-3 py-2 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <Icon
              className="mt-0.5 shrink-0"
              icon="solar:danger-triangle-outline"
              width={16}
            />
            <span className="text-xs">{error}</span>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            language="plaintext"
            options={{
              automaticLayout: true,
              bracketPairColorization: { enabled: false },
              contextmenu: true,
              cursorBlinking: "smooth",
              folding: false,
              fontSize: 14,
              formatOnPaste: false,
              lineNumbers: "on",
              links: false,
              minimap: { enabled: false },
              padding: { top: 12, bottom: 12 },
              quickSuggestions: false,
              readOnly: false,
              renderLineHighlight: "line",
              renderValidationDecorations: "off",
              scrollBeyondLastLine: false,
              suggestOnTriggerCharacters: false,
              tabSize: 2,
              wordBasedSuggestions: "off",
              wordWrap: "on",
            }}
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs-light"}
            value={value}
            onChange={(nextValue) => onChange(nextValue ?? "")}
            onMount={onMount}
          />
        </div>

        <div className="tool-panel-footer flex flex-wrap items-center justify-between gap-2">
          <span>{footerLabel}</span>
          <span>
            {characterCount.toLocaleString()} 字符 ·{" "}
            {byteCount.toLocaleString()} 字节
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

type EditSide = "plain" | "encoded";

interface ConversionRequest {
  id: number;
  side: EditSide;
  immediate: boolean;
}

const useToolState = createToolStateHook("encodingConverter");

export default function EncodingConverterPage() {
  const [encodingType, setEncodingType] = useToolState(
    "encodingType",
    "base64",
  );
  const [encodingOptions, setEncodingOptions] = useToolState(
    "options",
    cloneDefaultOptions,
  );
  const [plainText, setPlainText] = useToolState("plainText", "");
  const [encodedText, setEncodedText] = useToolState("encodedText", "");
  const [error, setError] = useState("");
  const [errorSide, setErrorSide] = useState<EditSide | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [request, setRequest] = useState<ConversionRequest | null>(null);
  const plainTextRef = useRef("");
  const encodedTextRef = useRef("");
  const latestRequestIdRef = useRef(0);
  const plainEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const encodedEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const requestConversion = (side: EditSide, immediate: boolean) => {
    const id = ++latestRequestIdRef.current;

    setRequest({ id, side, immediate });
  };

  const task = useBackgroundTask(
    encodingType + JSON.stringify(encodingOptions),
  );
  useEffect(() => {
    if (!request) return;

    const sourceValue =
      request.side === "plain" ? plainTextRef.current : encodedTextRef.current;

    if (!sourceValue) {
      if (request.side === "plain") {
        encodedTextRef.current = "";
        setEncodedText("");
      } else {
        plainTextRef.current = "";
        setPlainText("");
      }

      setError("");
      setErrorSide(null);
      setIsProcessing(false);

      return;
    }

    setIsProcessing(true);

    const timeoutId = window.setTimeout(
      async () => {
        if (request.id !== latestRequestIdRef.current) return;

        try {
          const result =
            (
              await task.run({
                action: request.side === "plain" ? "encode" : "decode",
                content: sourceValue,
                encoding: encodingType,
                options: encodingOptions,
              })
            ).content || "";
          if (request.id !== latestRequestIdRef.current) return;
          if (request.side === "plain") {
            encodedTextRef.current = result;
            setEncodedText(result);
          } else {
            plainTextRef.current = result;
            setPlainText(result);
          }

          setError("");
          setErrorSide(null);
        } catch (conversionError) {
          if (
            (conversionError as Error).name === "AbortError" ||
            request.id !== latestRequestIdRef.current
          )
            return;
          if (request.side === "plain") {
            encodedTextRef.current = "";
            setEncodedText("");
          } else {
            plainTextRef.current = "";
            setPlainText("");
          }

          setError(
            conversionError instanceof Error
              ? conversionError.message
              : "转换失败，请检查输入内容",
          );
          setErrorSide(request.side);
        } finally {
          if (request.id === latestRequestIdRef.current) {
            setIsProcessing(false);
          }
        }
      },
      request.immediate ? 0 : 150,
    );

    return () => {
      window.clearTimeout(timeoutId);
      task.cancel();
    };
  }, [encodingOptions, encodingType, request]);

  const handlePlainTextChange = (value: string, immediate = false) => {
    if (value === plainTextRef.current) return;

    plainTextRef.current = value;
    setPlainText(value);
    requestConversion("plain", immediate);
  };

  const handleEncodedTextChange = (value: string, immediate = false) => {
    if (value === encodedTextRef.current) return;

    encodedTextRef.current = value;
    setEncodedText(value);
    requestConversion("encoded", immediate);
  };

  const handleEncodingTypeChange = (type: EncodingType) => {
    const nextOptions = {
      ...encodingOptions,
      base64Padding:
        type === "base64url"
          ? false
          : type === "base64"
            ? true
            : encodingOptions.base64Padding,
    };

    setEncodingType(type);
    setEncodingOptions(nextOptions);
    requestConversion("plain", true);
  };

  const handleEncodingOptionsChange = (options: EncodingOptions) => {
    setEncodingOptions(options);
    requestConversion("plain", true);
  };

  const handleReset = () => {
    latestRequestIdRef.current += 1;
    plainTextRef.current = "";
    encodedTextRef.current = "";
    setEncodingType("base64");
    setEncodingOptions(cloneDefaultOptions());
    setPlainText("");
    setEncodedText("");
    setError("");
    setErrorSide(null);
    setIsProcessing(false);
    setRequest(null);
    plainEditorRef.current?.focus();
  };

  const handlePaste = async (side: EditSide) => {
    const value = await clipboard.read("无法读取剪贴板，请直接粘贴到编辑器");

    if (value === null) return;

    if (side === "plain") handlePlainTextChange(value, true);
    else handleEncodedTextChange(value, true);
  };

  const handleClear = (side: EditSide) => {
    if (side === "plain") {
      handlePlainTextChange("", true);
      plainEditorRef.current?.focus();
    } else {
      handleEncodedTextChange("", true);
      encodedEditorRef.current?.focus();
    }
  };

  const handleResizeComplete = () => {
    window.setTimeout(() => {
      plainEditorRef.current?.layout();
      encodedEditorRef.current?.layout();
    }, 50);
  };

  useEffect(() => {
    handleResizeComplete();
  }, []);

  const activeDirection = request?.side ?? "plain";
  const statusIndicator = (
    <Chip
      color={error ? "danger" : isProcessing ? "warning" : "success"}
      size="sm"
      startContent={
        isProcessing ? (
          <Spinner className="ml-1" color="current" size="sm" />
        ) : (
          <Icon
            className="ml-1"
            icon={
              error
                ? "solar:danger-circle-outline"
                : activeDirection === "plain"
                  ? "solar:arrow-right-linear"
                  : "solar:arrow-left-linear"
            }
            width={15}
          />
        )
      }
      variant="flat"
    >
      {error
        ? activeDirection === "plain"
          ? "编码失败"
          : "解码失败"
        : isProcessing
          ? activeDirection === "plain"
            ? "正在编码"
            : "正在解码"
          : activeDirection === "plain"
            ? "编码"
            : "解码"}
    </Chip>
  );

  return (
    <ToolboxPageTemplate
      description="从左侧选择编码格式，编辑任一侧实时同步结果。"
      actions={
        <Button
          size="sm"
          variant="ghost"
          onPress={handleReset}
          isDisabled={!plainText && !encodedText && encodingType === "base64"}
        >
          重置
        </Button>
      }
      statusIndicator={statusIndicator}
      toolIcon="solar:code-square-bold"
      toolIconColor="text-primary"
      toolName="编码转换"
    >
      <div className="tool-sidebar-layout">
        <aside className="tool-sidebar" aria-label="编码格式">
          <h2 className="tool-sidebar-title">编码格式</h2>
          <div className="tool-format-list">
            {ENCODINGS.map((encoding) => (
              <button
                key={encoding.type}
                className="tool-format-option"
                aria-pressed={encodingType === encoding.type}
                onClick={() => handleEncodingTypeChange(encoding.type)}
              >
                <Icon icon={encoding.icon} width={18} />
                <span>
                  {encoding.label}
                  <small>{encoding.description}</small>
                </span>
              </button>
            ))}
          </div>
          <details className="tool-encoding-options" open>
            <summary className="tool-sidebar-title cursor-pointer">
              格式选项
            </summary>
            <FormatOptions
              type={encodingType}
              options={encodingOptions}
              onChange={handleEncodingOptionsChange}
            />
          </details>
        </aside>
        <div className="tool-editor-workspace">
          <ResizableEditorLayout
            className="h-full"
            initialLeftWidth={50}
            isStacked
            maxLeftWidth={70}
            minLeftWidth={30}
            onResizeComplete={handleResizeComplete}
          >
            <EditorPanel
              error={errorSide === "plain" ? error : undefined}
              footerLabel="编辑原始文本，实时编码"
              title="原始文本"
              type="text"
              value={plainText}
              onChange={handlePlainTextChange}
              onClear={() => handleClear("plain")}
              onCopy={() => clipboard.copy(plainText, "原始文本已复制")}
              onMount={(instance) => {
                plainEditorRef.current = instance;
                instance.focus();
              }}
              onPaste={() => handlePaste("plain")}
            />
            <EditorPanel
              error={errorSide === "encoded" ? error : undefined}
              footerLabel="编辑编码内容，实时解码"
              title={`${ENCODING_MAP.get(encodingType)?.label} 内容`}
              type={encodingType}
              value={encodedText}
              onChange={handleEncodedTextChange}
              onClear={() => handleClear("encoded")}
              onCopy={() => clipboard.copy(encodedText, "编码内容已复制")}
              onMount={(instance) => {
                encodedEditorRef.current = instance;
              }}
              onPaste={() => handlePaste("encoded")}
            />
          </ResizableEditorLayout>
        </div>
      </div>
    </ToolboxPageTemplate>
  );
}
