import AIAssistantHeader from "@/components/ai/AIAssistantHeader";
import { formatEditorDocument } from "./formatDocument";
import { applyTextChanges } from "./textChanges";
import { Sheet } from "@/components/ui/sheet";
import { DiffPreview } from "@/components/workspace/DiffPreview";
import { createEditorAdapter } from "./editorAdapter";
import { createPortal } from "react-dom";
import React, {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as monaco from "monaco-editor";
import { getMonacoTheme } from "./editorTheme";
import { initMonacoGlobally } from "./decorations/decorationInit";
import { useDataLanguage } from "@/hooks/useDataLanguage";
import { useEditorIndentation } from "@/hooks/useEditorIndentation";
import {
  documentDownloadName,
  supportsJsonOperations,
  supportsFormatting,
  type LanguageMode,
} from "@/utils/dataFormats";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import {
  Copy,
  Filter,
  X,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import {
  getDocumentModel,
  saveEditorView,
  restoreEditorView,
} from "./modelRegistry";
import {
  updateDecoder,
  clearEditorDecoders,
} from "./decorations/decoderEngine";
import { ToolContext } from "@/components/workspace/ToolContext";
import { useTabStore } from "@/store/useTabStore";
import { runJsonTask, cancelJsonTask } from "@/workers/client";
import type { JsonTask } from "@/workers/jsonTasks";
import { type JsonErrorInfo } from "@/utils/json";
import { convertJsonKeys } from "@/utils/keyNamingConverter";
import clipboard from "@/utils/clipboard";
import toast from "@/utils/toast";
import { useDelayedVisibility } from "@/hooks/useDelayedVisibility";
import DraggableMenu from "./DraggableMenu";
import LanguageSelector from "./LanguageSelector";
import IndentationSelector from "./IndentationSelector";
import ErrorModal from "./ErrorModal";
import JsonPathHelp from "./JsonPathHelp";
import ReadOnlyMonacoEditor from "./ReadOnlyMonacoEditor";
import AIPromptOverlay, {
  type QuickPrompt,
} from "@/components/ai/AIPromptOverlay";
import PromptContainer, {
  type PromptContainerRef,
} from "@/components/ai/PromptContainer";
import { jsonQuickPrompts } from "@/components/ai/JsonQuickPrompts";
import "@/styles/monaco.css";
export interface MonacoDataEditorProps {
  tabTitle?: string;
  tabKey: string;
  height?: number | string;
  value?: string;
  documentId?: string;
  language?: string;
  languageMode?: LanguageMode;
  filename?: string;
  theme?: string;
  minimap?: boolean;
  isSetting?: boolean; // 是否显示设置按钮
  isMenu?: boolean; // 是否显示悬浮菜单按钮
  showAi?: boolean; // 是否显示AI功能
  customQuickPrompts?: QuickPrompt[]; // 自定义快捷指令
  showTimestampDecorators?: boolean; // 是否显示时间戳装饰器
  statusBarTarget?: HTMLElement | null;
  languageBarTarget?: HTMLElement | null;
  indentationBarTarget?: HTMLElement | null;
  settingsBarTarget?: HTMLElement | null;
  showJsonPathFilter?: boolean; // 是否显示 JSONPath 查询功能
  queryLayout?: "inline" | "console";
  onUpdateValue: (
    value: string,
    changes?: readonly monaco.editor.IModelContentChange[],
  ) => void;
  onMount?: () => void;
  ref?: React.Ref<MonacoDataEditorRef>;
}

export interface MonacoDataEditorRef {
  setQuery: (query: string) => void;
  focus: () => void;
  layout: () => void;
  copy: () => boolean;
  compress: () => boolean;
  escape: () => boolean;
  format: () => boolean;
  validate: () => boolean;
  clear: () => boolean;
  fieldSort: (type: "asc" | "desc") => boolean;
  moreAction: (key: "unescape" | "del_comment") => boolean;
  saveFile: () => boolean;
  updateValue: (value: string) => void;
  setLanguage: (language: string) => void;
  showAiPrompt: () => void;
  toggleTimestampDecorators: (enabled?: boolean) => boolean; // 切换时间戳装饰器
  toggleBase64Decorators: (enabled?: boolean) => boolean; // 切换Base64装饰器
  toggleUnicodeDecorators: (enabled?: boolean) => boolean; // 切换Unicode装饰器
  toggleUrlDecorators: (enabled?: boolean) => boolean; // 切换URL装饰器
  toggleImageDecorators: (enabled?: boolean) => boolean; // 切换图片装饰器
}
export default function MonacoDataEditor({
  value: providedValue = "",
  documentId,
  tabKey,
  tabTitle,
  language,
  languageMode,
  filename,
  theme: requestedTheme = "vs-light",
  height = "100%",
  minimap = false,
  isMenu = false,
  showTimestampDecorators = true,
  showJsonPathFilter = false,
  queryLayout = "inline",
  statusBarTarget,
  languageBarTarget,
  indentationBarTarget,
  settingsBarTarget,
  customQuickPrompts,
  onUpdateValue,
  onMount,
  ref,
}: MonacoDataEditorProps) {
  const theme = getMonacoTheme(requestedTheme);
  useTabStore((s) =>
    documentId ? s.getTabByKey(documentId)?.revision : undefined,
  );
  const value = documentId
    ? useTabStore.getState().getTabByKey(documentId)?.content || ""
    : providedValue;
  const context = useContext(ToolContext);
  const owner = context || tabKey;
  const modelKey = context ? `${context}::${tabKey}` : tabKey;
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelText = useRef(value);
  const callback = useRef(onUpdateValue);
  callback.current = onUpdateValue;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<JsonErrorInfo | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const showBusy = useDelayedVisibility(busy);
  const stored = useTabStore.getState().getTabByKey(owner)?.editorSettings;
  const [fontSize, setFontSize] = useState(stored?.fontSize || 14);
  const indentation = useEditorIndentation(owner, ready, () => {
    const model = editor.current?.getModel();
    return model ? [model] : [];
  });
  const { indentSize: indent } = indentation;
  const [localMode, setMode] = useState<LanguageMode>(
    languageMode || (language ? "manual" : "auto"),
  );
  const [manualLanguage, setManualLanguage] = useState(language || "json");
  // Documents use their saved settings directly, including changes from other views.
  const mode = documentId
    ? languageMode || (language ? "manual" : "auto")
    : localMode;
  const currentLanguage = useDataLanguage(
    value,
    documentId ? language || "json" : manualLanguage,
    mode,
    filename,
    modelKey,
  );
  const jsonSupported = supportsJsonOperations(currentLanguage);
  function setLanguage(next: string) {
    if (documentId) {
      useTabStore.getState().updateEditorSettings(documentId, {
        languageMode: next === "auto" ? "auto" : "manual",
        ...(next === "auto" ? {} : { language: next }),
      });
      return;
    }
    setMode(next === "auto" ? "auto" : "manual");
    if (next !== "auto") setManualLanguage(next);
  }
  const [decoders, setDecoders] = useState({
    timestamp: stored?.timestampDecoratorsEnabled ?? showTimestampDecorators,
    base64: stored?.base64DecoratorsEnabled ?? true,
    unicode: stored?.unicodeDecoratorsEnabled ?? true,
    url: stored?.urlDecoratorsEnabled ?? true,
    image: stored?.imageDecoratorsEnabled ?? true,
  });
  const decoderState = useRef(decoders);
  decoderState.current = decoders;
  const [stats, setStats] = useState({
    line: 1,
    column: 1,
    chars: 0,
    lines: 1,
    selected: 0,
  });
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState("");
  const [queryError, setQueryError] = useState("");
  const [queryBusy, setQueryBusy] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [side, setSide] = useState<"ai" | "query" | null>(null);
  const inlineQuery =
    showJsonPathFilter && queryLayout === "console" && side !== "ai";
  const sidePanel = useRef<ImperativePanelHandle>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 768);
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiContext, setAIContext] = useState({
    content: value,
    selection: false,
    version: 0,
  });
  const pendingPrompt = useRef("");
  const promptRef = useRef<PromptContainerRef>(null);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [replaceVersion, setReplaceVersion] = useState(0);
  const messagesKey = `${modelKey}:aiMessages`;
  const initialMessages = useRef(
    useTabStore.getState().getTabByKey(owner)?.toolState[messagesKey] as
      | Array<{
          role: "user" | "assistant";
          content: string;
          timestamp: number;
        }>
      | undefined,
  );
  const persistMessages = useCallback(
    (
      messages: Array<{
        role: "user" | "assistant";
        content: string;
        timestamp: number;
      }>,
    ) => useTabStore.getState().setToolState(owner, messagesKey, messages),
    [owner, messagesKey],
  );
  function apply(text: string) {
    if (editor.current)
      createEditorAdapter(modelKey, editor.current).apply(text);
  }
  const validate = useCallback(() => {
    const model = editor.current?.getModel();
    if (!model || !["json", "json5"].includes(model.getLanguageId())) {
      setError(null);
      if (model) monaco.editor.setModelMarkers(model, "datamorph", []);
      return;
    }
    const version = model.getVersionId();
    const validatingLanguage = model.getLanguageId();
    void runJsonTask(modelKey + ":validation", {
      action: "validate",
      content: model.getValue(),
      language: model.getLanguageId(),
    })
      .then((result) => {
        if (
          model.isDisposed() ||
          model.getVersionId() !== version ||
          model.getLanguageId() !== validatingLanguage
        )
          return;
        const err = result.error
          ? {
              ...result.error,
              contextStartLine: Math.max(1, result.error.line - 2),
              context: model.getValueInRange(
                new monaco.Range(
                  Math.max(1, result.error.line - 2),
                  1,
                  Math.min(model.getLineCount(), result.error.line + 2),
                  1000,
                ),
              ),
            }
          : null;
        setError(err);
        monaco.editor.setModelMarkers(
          model,
          "datamorph",
          err
            ? [
                {
                  severity: monaco.MarkerSeverity.Error,
                  message: err.message,
                  startLineNumber: Math.max(1, err.line),
                  startColumn: Math.max(1, err.column),
                  endLineNumber: Math.max(1, err.line),
                  endColumn: Math.max(2, err.column + 1),
                },
              ]
            : [],
        );
      })
      .catch(() => {});
  }, [modelKey]);
  function run(action: JsonTask, direction?: "asc" | "desc") {
    const model = editor.current?.getModel();
    if (!model) return false;
    if (!supportsJsonOperations(model.getLanguageId())) return false;
    const version = model.getVersionId();
    const language = model.getLanguageId();
    const options = indentation.resolve(model);
    setBusy(true);
    void runJsonTask(modelKey + ":action", {
      action,
      content: model.getValue(),
      language: model.getLanguageId(),
      indent: options.tabSize,
      insertSpaces: options.insertSpaces,
      direction,
    })
      .then((result) => {
        if (model.isDisposed() || editor.current?.getModel() !== model) return;
        if (
          model.getVersionId() !== version ||
          model.getLanguageId() !== language
        ) {
          toast.warning("内容已变化，请重新执行");
          return;
        }
        if (result.content !== undefined) apply(result.content);
      })
      .catch((err) => {
        if (err.name !== "AbortError") toast.error("处理失败", err.message);
      })
      .finally(() => setBusy(false));
    return true;
  }
  function format() {
    const ed = editor.current;
    const language = ed?.getModel()?.getLanguageId() || "";
    if (!ed || !supportsFormatting(language)) return false;
    if (supportsJsonOperations(language)) return run("format");
    indentation.resolve(ed.getModel()!);
    setBusy(true);
    void formatEditorDocument(ed)
      .catch((error) => {
        if (error.name !== "AbortError")
          toast.error("格式化失败", error.message);
      })
      .finally(() => setBusy(false));
    return true;
  }
  const formatRef = useRef(format);
  formatRef.current = format;
  const download = () => {
    const text = editor.current?.getValue() || "";
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = documentDownloadName(tabTitle, currentLanguage, filename);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  };
  function openAI() {
    const ed = editor.current,
      model = ed?.getModel(),
      selection = ed?.getSelection();
    const selected =
      model && selection && !selection.isEmpty()
        ? model.getValueInRange(selection)
        : "";
    setAIContext({
      content: selected || model?.getValue() || "",
      selection: !!selected,
      version: model?.getVersionId() || 0,
    });
    setPromptOpen(true);
  }
  function toggle(kind: keyof typeof decoders, enabled?: boolean) {
    const next = enabled ?? !decoderState.current[kind];
    setDecoders((prev) => ({ ...prev, [kind]: next }));
    if (editor.current) updateDecoder(kind, editor.current, { enabled: next });
    return next;
  }
  useImperativeHandle(ref, () => ({
    setQuery,
    focus: () => editor.current?.focus(),
    layout: () => editor.current?.layout(),
    copy: () => {
      void clipboard.copy(editor.current?.getValue() || "", "已复制");
      return true;
    },
    compress: () => run("compress"),
    escape: () => run("escape"),
    format,
    validate: () => {
      validate();
      return !error;
    },
    clear: () => {
      apply("");
      return true;
    },
    fieldSort: (direction) => run("sort", direction),
    moreAction: (action) =>
      run(action === "del_comment" ? "comments" : "unescape"),
    saveFile: download,
    updateValue: apply,
    setLanguage,
    showAiPrompt: openAI,
    toggleTimestampDecorators: (enabled) => toggle("timestamp", enabled),
    toggleBase64Decorators: (enabled) => toggle("base64", enabled),
    toggleUnicodeDecorators: (enabled) => toggle("unicode", enabled),
    toggleUrlDecorators: (enabled) => toggle("url", enabled),
    toggleImageDecorators: (enabled) => toggle("image", enabled),
  }));
  useEffect(() => {
    let disposed = false;
    let validationTimer: ReturnType<typeof setTimeout> | undefined;
    let decorationTimer: ReturnType<typeof setTimeout> | undefined;
    let ed: monaco.editor.IStandaloneCodeEditor | undefined;
    const subscriptions: monaco.IDisposable[] = [];
    void initMonacoGlobally().then(() => {
      if (disposed || !host.current) return;
      const model = getDocumentModel(modelKey, value, currentLanguage);
      modelText.current = model.getValue();
      ed = monaco.editor.create(host.current, {
        model,
        theme,
        automaticLayout: true,
        minimap: { enabled: minimap },
        fontSize,
        fontFamily: '"SFMono-Regular",Consolas,monospace',
        wordWrap: "on",
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 12 },
        lineNumbersMinChars: 3,
        renderLineHighlight: "gutter",
        links: true,
        stickyScroll: { enabled: false },
        quickSuggestions: false,
        formatOnPaste: false,
      });
      editor.current = ed;
      restoreEditorView(modelKey, ed);
      setReady(true);
      onMount?.();
      const stats = () => {
        if (!ed) return;
        const position = ed.getPosition();
        const selection = ed.getSelection();
        setStats({
          line: position?.lineNumber || 1,
          column: position?.column || 1,
          chars: model.getValueLength(),
          lines: model.getLineCount(),
          selected: selection ? model.getValueLengthInRange(selection) : 0,
        });
      };
      const decorate = () => {
        clearTimeout(decorationTimer);
        decorationTimer = setTimeout(() => {
          if (!ed || disposed) return;
          for (const [kind, enabled] of Object.entries(decoderState.current))
            updateDecoder(kind as keyof typeof decoders, ed, { enabled });
        }, 120);
      };
      subscriptions.push(
        ed.onDidChangeModelContent((event) => {
          modelText.current = event.isFlush
            ? ed!.getValue()
            : applyTextChanges(modelText.current, event.changes);
          callback.current(modelText.current, event.changes);
          stats();
          clearTimeout(validationTimer);
          validationTimer = setTimeout(
            validate,
            model.getValueLength() > 1_000_000 ? 1000 : 400,
          );
          decorate();
        }),
        ed.onDidChangeCursorSelection(stats),
        ed.onDidScrollChange(decorate),
      );
      subscriptions.push(
        ed.addAction({
          id: "datamorph-format",
          label: "格式化数据",
          keybindings: [
            monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
          ],
          run: () => {
            formatRef.current();
          },
        }),
      );
      stats();
      validate();
      decorate();
    });
    const reveal = (event: Event) => {
      const detail = (
        event as CustomEvent<{ key: string; line: number; column: number }>
      ).detail;
      if (detail.key !== tabKey || !editor.current) return;
      editor.current.revealLineInCenter(detail.line);
      editor.current.setPosition({
        lineNumber: detail.line,
        column: detail.column,
      });
      editor.current.focus();
    };
    window.addEventListener("datamorph:reveal", reveal);
    return () => {
      disposed = true;
      clearTimeout(validationTimer);
      clearTimeout(decorationTimer);
      subscriptions.forEach((s) => s.dispose());
      window.removeEventListener("datamorph:reveal", reveal);
      ["validation", "action", "query"].forEach((scope) =>
        cancelJsonTask(modelKey + ":" + scope),
      );
      if (ed) {
        saveEditorView(modelKey, ed);
        clearEditorDecoders(ed);
        ed.dispose();
      }
      editor.current = null;
    };
  }, [modelKey]);
  useEffect(() => {
    if (ready && modelText.current !== value) apply(value);
  }, [value, ready]);
  useEffect(() => {
    editor.current?.updateOptions({ theme, fontSize });
    const model = editor.current?.getModel();
    if (model) monaco.editor.setModelLanguage(model, currentLanguage);
  }, [theme, fontSize, currentLanguage, ready]);
  useEffect(() => {
    if (!documentId && language) setManualLanguage(language);
  }, [language, documentId]);
  useEffect(() => {
    if (!documentId && languageMode) setMode(languageMode);
  }, [languageMode, documentId]);
  useEffect(() => {
    cancelJsonTask(modelKey + ":validation");
    setError(null);
    const model = editor.current?.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, "datamorph", []);
      if (!jsonSupported) monaco.editor.setModelMarkers(model, "json", []);
      if (editor.current) {
        for (const [kind, enabled] of Object.entries(decoderState.current))
          updateDecoder(kind as keyof typeof decoders, editor.current, {
            enabled: enabled && jsonSupported,
          });
      }
    }
    if (jsonSupported) validate();
  }, [currentLanguage, ready, jsonSupported, modelKey, validate]);
  useEffect(() => {
    useTabStore.getState().updateEditorSettings(owner, {
      fontSize,
      ...(documentId ? { language: currentLanguage, languageMode: mode } : {}),
      timestampDecoratorsEnabled: decoders.timestamp,
      base64DecoratorsEnabled: decoders.base64,
      unicodeDecoratorsEnabled: decoders.unicode,
      urlDecoratorsEnabled: decoders.url,
      imageDecoratorsEnabled: decoders.image,
    });
  }, [owner, fontSize, currentLanguage, mode, decoders, documentId]);
  useEffect(() => {
    if ((side || inlineQuery) && (!narrow || inlineQuery))
      sidePanel.current?.resize(inlineQuery ? 50 : 38);
    else sidePanel.current?.collapse();
  }, [side, narrow, inlineQuery]);
  useEffect(() => {
    const resize = () => setNarrow(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    let active = true;
    const scope = modelKey + ":query";
    setQueryError("");
    setQueryResult("");
    setMatchCount(null);
    if (!query.trim() || !showJsonPathFilter || !jsonSupported) {
      setQueryBusy(false);
      cancelJsonTask(scope);
      setSide((current) => (current === "query" ? null : current));
      return;
    }
    setQueryBusy(true);
    const timer = setTimeout(() => {
      const model = editor.current?.getModel();
      if (!model) return;
      const version = model.getVersionId();
      void runJsonTask(scope, {
        action: "query",
        content: model.getValue(),
        language: currentLanguage,
        query,
        indent,
      })
        .then((result) => {
          if (!active || model.isDisposed() || model.getVersionId() !== version)
            return;
          setQueryResult(result.content || "[]");
          setMatchCount(result.matchCount ?? 0);
          setQueryBusy(false);
          setSide("query");
        })
        .catch((err) => {
          if (!active) return;
          setQueryBusy(false);
          if (err.name !== "AbortError") setQueryError(err.message);
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
      cancelJsonTask(scope);
    };
  }, [
    query,
    value,
    modelKey,
    indent,
    currentLanguage,
    ready,
    showJsonPathFilter,
    jsonSupported,
  ]);
  const closeAssistant = () => {
    if (side === "query") setQuery("");
    setSide(null);
  };
  const goToError = () => {
    if (!error || !editor.current) return;
    editor.current.revealLineInCenter(error.line);
    editor.current.setPosition({
      lineNumber: Math.max(1, error.line),
      column: Math.max(1, error.column),
    });
    editor.current.focus();
  };
  const assistantContent = (side || inlineQuery) && (
    <aside
      className={
        side === "ai"
          ? "ai-surface ai-dock flex h-full min-h-0 flex-col"
          : "flex h-full min-h-0 flex-col border-l bg-background"
      }
    >
      {side === "ai" ? (
        <AIAssistantHeader
          fileName={tabTitle || "当前文档"}
          contextLabel={
            aiContext.selection ? "上下文 · 选中内容" : "上下文 · 完整文件"
          }
          onClose={closeAssistant}
        />
      ) : (
        <div
          className={
            inlineQuery
              ? "tool-panel-header"
              : "flex items-center justify-between border-b bg-muted/40 px-3 py-2"
          }
        >
          <span className="flex items-center gap-2 text-xs font-medium">
            <Filter className="size-4 text-primary" />
            JSONPath 结果
            {matchCount !== null && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                {matchCount} 项匹配
              </span>
            )}
          </span>
          {!inlineQuery && (
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              aria-label="关闭辅助面板"
              onPress={closeAssistant}
            >
              <X />
            </Button>
          )}
        </div>
      )}
      {side === "ai" ? (
        <>
          <div className="min-h-0 flex-1">
            <PromptContainer
              ref={(node) => {
                promptRef.current = node;
                if (node && pendingPrompt.current)
                  setTimeout(() => {
                    if (promptRef.current && pendingPrompt.current) {
                      const text = pendingPrompt.current;
                      pendingPrompt.current = "";
                      promptRef.current.sendMessage(text);
                    }
                  }, 0);
              }}
              initialMessages={initialMessages.current}
              onMessagesChange={persistMessages}
              editorContent={aiContext.content}
              useDirectApi
              onApplyCode={(code) => {
                setReplacement(code);
                setReplaceVersion(
                  editor.current?.getModel()?.getVersionId() || 0,
                );
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b p-1">
            <Button
              size="sm"
              variant="ghost"
              isDisabled={matchCount === null || queryBusy}
              onPress={() => void clipboard.copy(queryResult, "已复制结果")}
            >
              <Copy />
              复制
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={matchCount === null || queryBusy}
              onPress={() =>
                useTabStore
                  .getState()
                  .addTab("jsonpath-result.json", queryResult)
              }
            >
              <ArrowRight />
              新标签
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={matchCount === null || queryBusy}
              onPress={() => {
                setReplacement(queryResult);
                setReplaceVersion(
                  editor.current?.getModel()?.getVersionId() || 0,
                );
              }}
            >
              替换原文
            </Button>
          </div>
          <div className="border-b bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
            {query}
          </div>
          {!query.trim() ? (
            <div className="flex flex-1 items-center justify-center p-5 text-center text-xs text-muted-foreground">
              输入 JSONPath 表达式，匹配结果会在这里实时显示。
            </div>
          ) : queryBusy ? (
            <div
              role="status"
              className="flex items-center gap-2 p-4 text-xs text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              正在查询…
            </div>
          ) : queryError ? (
            <div className="p-4 text-xs text-destructive">
              请修正表达式或源数据后重试。
            </div>
          ) : (
            <>
              {matchCount === 0 && (
                <div className="flex items-start gap-2 border-b bg-muted/30 p-3 text-xs text-muted-foreground">
                  <Search className="size-4 shrink-0" />
                  <span>未找到匹配项，请检查字段名称或筛选条件。</span>
                </div>
              )}
              <div className="min-h-0 flex-1">
                <ReadOnlyMonacoEditor
                  ariaLabel="JSONPath 查询结果"
                  value={queryResult}
                  theme={theme}
                />
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
  return (
    <div
      ref={root}
      className={`relative flex h-full min-h-0 flex-col${queryLayout === "console" ? " query-console" : ""}`}
      style={{ height }}
    >
      {showBusy && (
        <div className="flex items-center justify-between border-b bg-accent px-3 py-1 text-xs">
          <span>正在后台处理…</span>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => cancelJsonTask(modelKey + ":action")}
          >
            取消
          </Button>
        </div>
      )}
      <PanelGroup
        direction={narrow ? "vertical" : "horizontal"}
        className="min-h-0 flex-1"
      >
        <Panel defaultSize={inlineQuery ? 50 : 100} minSize={25}>
          <div
            className={`relative h-full${inlineQuery ? " query-console-source" : ""}`}
          >
            {inlineQuery && (
              <div className="tool-panel-header">
                <h2>源数据 · JSON</h2>
                <Button size="sm" variant="ghost" onPress={() => run("format")}>
                  格式化
                </Button>
              </div>
            )}
            <div
              ref={host}
              className={`h-full w-full${inlineQuery ? " query-console-host" : ""}`}
            />
            {isMenu && (
              <DraggableMenu
                toolbarTarget={settingsBarTarget}
                containerRef={root}
                tabKey={owner}
                currentFontSize={fontSize}
                currentIndentSize={indent}
                currentIndentMode={indentation.indentMode}
                insertSpaces={indentation.insertSpaces}
                onFontSizeChange={setFontSize}
                onIndentSizeChange={indentation.setSize}
                onIndentModeChange={indentation.setMode}
                timestampDecoratorsEnabled={decoders.timestamp}
                onTimestampDecoratorsChange={(enabled) =>
                  toggle("timestamp", enabled)
                }
                imageDecoratorsEnabled={decoders.image}
                onImageDecoratorsChange={(enabled) => toggle("image", enabled)}
                onReset={() => {
                  setFontSize(14);
                  indentation.reset();
                }}
              />
            )}
          </div>
        </Panel>
        <PanelResizeHandle
          className={
            (side || inlineQuery) && (!narrow || inlineQuery)
              ? `bg-border transition-colors hover:bg-primary ${narrow ? "h-1" : "w-1"}`
              : "hidden"
          }
        />
        <Panel
          ref={sidePanel}
          defaultSize={inlineQuery ? 50 : 0}
          minSize={20}
          collapsible
          collapsedSize={0}
        >
          {(!narrow || inlineQuery) && assistantContent}
        </Panel>
      </PanelGroup>
      {narrow && !inlineQuery && (
        <Sheet
          open={!!side}
          onOpenChange={(open) => {
            if (!open) closeAssistant();
          }}
          title={side === "ai" ? "AI 助手" : "查询结果"}
        >
          {assistantContent}
        </Sheet>
      )}
      {showJsonPathFilter && jsonSupported && (
        <div className="jsonpath-query-area">
          <div className="editor-query-bar">
            <span className="jsonpath-query-icon" aria-hidden="true">
              <Filter className="size-3.5" />
            </span>
            <input
              aria-label="JSONPath 表达式"
              aria-invalid={!!queryError}
              placeholder="输入 JSONPath，例如 $.users[*].name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {queryBusy ? (
              <LoaderCircle
                aria-label="正在查询"
                className="size-3.5 shrink-0 animate-spin text-muted-foreground"
              />
            ) : queryError ? (
              <AlertCircle
                aria-label="查询失败"
                className="size-3.5 shrink-0 text-destructive"
              />
            ) : matchCount !== null ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {matchCount} 项
              </span>
            ) : null}
            <JsonPathHelp onSelect={setQuery} />
            {query && (
              <Button
                size="sm"
                isIconOnly
                variant="ghost"
                aria-label="清空查询"
                onPress={() => setQuery("")}
              >
                <X />
              </Button>
            )}
          </div>
          {queryError && (
            <div
              role="alert"
              className="flex items-start gap-2 border-t border-destructive/15 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{queryError}</span>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="flex shrink-0 items-center gap-2 border-t border-destructive/20 bg-destructive/5 px-3 py-1 text-xs">
          <button
            className="flex-1 truncate text-left text-destructive"
            onClick={goToError}
          >
            第 {error.line} 行，{error.column} 列 · {error.message}
          </button>
          <Button size="sm" variant="ghost" onPress={() => setErrorOpen(true)}>
            详情
          </Button>
          <Button size="sm" variant="ghost" onPress={() => run("repair")}>
            修复
          </Button>
        </div>
      )}
      {statusBarTarget === undefined ? (
        <div className="editor-local-status">
          <span>
            行 {stats.line}，列 {stats.column}
          </span>
          <span>
            {stats.chars.toLocaleString()} 字符 · {stats.lines.toLocaleString()}{" "}
            行{stats.selected ? ` · ${stats.selected} 选中` : ""}
          </span>
          {isMenu && languageBarTarget === undefined && (
            <LanguageSelector
              language={currentLanguage}
              languageMode={mode}
              onLanguageChange={setLanguage}
            />
          )}
        </div>
      ) : statusBarTarget ? (
        createPortal(
          <span
            className="editor-cursor-status"
            title={`${stats.chars.toLocaleString()} 字符 · ${stats.lines.toLocaleString()} 行`}
          >
            行 {stats.line}，列 {stats.column}
            {stats.selected ? ` · ${stats.selected} 选中` : ""}
          </span>,
          statusBarTarget,
        )
      ) : null}
      {isMenu &&
        languageBarTarget &&
        createPortal(
          <LanguageSelector
            language={currentLanguage}
            languageMode={mode}
            onLanguageChange={setLanguage}
          />,
          languageBarTarget,
        )}
      {indentationBarTarget &&
        createPortal(
          <IndentationSelector
            indentMode={indentation.indentMode}
            indentSize={indent}
            insertSpaces={indentation.insertSpaces}
            onModeChange={(mode) => {
              indentation.setMode(mode);
              format();
            }}
            onSizeChange={(size) => {
              indentation.setSize(size);
              format();
            }}
          />,
          indentationBarTarget,
        )}
      <AIPromptOverlay
        isOpen={promptOpen}
        prompt={prompt}
        onPromptChange={setPrompt}
        onClose={() => setPromptOpen(false)}
        quickPrompts={customQuickPrompts || jsonQuickPrompts}
        onQuickPromptClick={(quick) => {
          if (quick.handler) {
            quick.handler();
            return;
          }
          if (quick.id === "convert_to_snake_case") {
            try {
              apply(
                convertJsonKeys(
                  editor.current?.getValue() || "",
                  "snake",
                  indent,
                ),
              );
              setPromptOpen(false);
            } catch (err) {
              toast.error("字段转换失败", String(err));
            }
            return;
          }
          setPrompt(quick.prompt);
        }}
        onSubmit={() => {
          if (!prompt.trim()) return;
          pendingPrompt.current = prompt;
          setPrompt("");
          setPromptOpen(false);
          if (side === "ai" && promptRef.current) {
            promptRef.current.sendMessage(pendingPrompt.current);
            pendingPrompt.current = "";
          } else setSide("ai");
        }}
      />
      <ErrorModal
        parseJsonError={error}
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        onGotoErrorLine={goToError}
        onAutoFix={() => run("repair")}
      />
      <Modal
        isOpen={replacement !== null}
        onClose={() => setReplacement(null)}
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>预览替换内容</ModalHeader>
          <ModalBody>
            <DiffPreview
              original={replacement === null ? "" : modelText.current}
              modified={replacement || ""}
            />
            {aiContext.version !== replaceVersion && side === "ai" && (
              <p className="mt-3 text-xs text-warning">
                文件在生成期间已变化，请核对后应用。
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setReplacement(null)}>取消</Button>
            <Button
              color="primary"
              onPress={() => {
                if (
                  editor.current?.getModel()?.getVersionId() !== replaceVersion
                ) {
                  setReplaceVersion(
                    editor.current?.getModel()?.getVersionId() || 0,
                  );
                  toast.warning("内容已变化，请重新核对预览");
                  return;
                }
                apply(replacement || "");
                setReplacement(null);
              }}
            >
              应用替换，可撤销
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
