import AIAssistantHeader from "@/components/ai/AIAssistantHeader";
import { Sheet } from "@/components/ui/sheet";
import { DiffPreview } from "@/components/workspace/DiffPreview";
import React, {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import * as monaco from "monaco-editor";
import { getMonacoTheme } from "./editorTheme";
import { initMonacoGlobally } from "./decorations/decorationInit";
import { useDataLanguage } from "@/hooks/useDataLanguage";
import { useEditorIndentation } from "@/hooks/useEditorIndentation";
import {
  supportsJsonOperations,
  supportsFormatting,
  type LanguageMode,
} from "@/utils/dataFormats";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import { ToolContext, useToolState } from "@/components/workspace/ToolContext";
import { useTabStore } from "@/store/useTabStore";
import {
  getDocumentModel,
  restoreEditorView,
  saveEditorView,
} from "./modelRegistry";
import { formatEditorDocument } from "./formatDocument";
import { createEditorAdapter } from "./editorAdapter";
import {
  updateDecoder,
  clearEditorDecoders,
} from "./decorations/decoderEngine";
import type { DecoderKind } from "./decorations/detectors";
import { runJsonTask, cancelJsonTask } from "@/workers/client";
import { MonacoDiffEditorEditorType as Side } from "./monacoEntity";
import type { MonacoDiffEditorEditorType } from "./monacoEntity";
import DraggableMenu from "./DraggableMenu";
import LanguageSelector from "./LanguageSelector";
import AIPromptOverlay, {
  type QuickPrompt,
} from "@/components/ai/AIPromptOverlay";
import PromptContainer, {
  type PromptContainerRef,
} from "@/components/ai/PromptContainer";
import { diffJsonQuickPrompts } from "@/components/ai/JsonQuickPrompts";
import clipboard from "@/utils/clipboard";
import toast from "@/utils/toast";
import { useDelayedVisibility } from "@/hooks/useDelayedVisibility";
import "@/styles/monaco.css";
export interface MonacoDiffEditorProps {
  tabKey: string;
  tabTitle?: string;
  height?: number | string;
  originalValue: string;
  modifiedValue: string;
  language?: string;
  languageMode?: LanguageMode;
  filename?: string;
  onLanguagesChange?: (languages: { left: string; right: string }) => void;
  theme?: string;
  settingsBarTarget?: HTMLElement | null;
  languageBarTarget?: HTMLElement | null;
  customQuickPrompts?: QuickPrompt[];
  showTimestampDecorators?: boolean;
  showBase64Decorators?: boolean;
  showUnicodeDecorators?: boolean;
  showUrlDecorators?: boolean;
  showImageDecorators?: boolean;
  onUpdateOriginalValue: (value: string) => void;
  onUpdateModifiedValue?: (value: string) => void;
  onMount?: () => void;

  ref?: React.Ref<MonacoDiffEditorRef>;
}

export interface MonacoDiffEditorRef {
  clear: (type?: MonacoDiffEditorEditorType) => boolean;
  copy: (type?: MonacoDiffEditorEditorType) => boolean;
  fieldSort: (
    type?: MonacoDiffEditorEditorType,
    sort?: "asc" | "desc",
  ) => boolean;
  focus: () => void;
  format: (type?: MonacoDiffEditorEditorType) => boolean;
  layout: () => void;
  showAiPrompt: () => void;
  updateModifiedValue: (value: string) => void;
  updateOriginalValue: (value: string) => void;
  toggleTimestampDecorators: (enabled?: boolean) => boolean;
  toggleBase64Decorators: (enabled?: boolean) => boolean;
  toggleUnicodeDecorators: (enabled?: boolean) => boolean;
  toggleUrlDecorators: (enabled?: boolean) => boolean;
  toggleImageDecorators: (enabled?: boolean) => boolean;
}

export default function MonacoDiffEditor({
  tabKey,
  tabTitle,
  originalValue,
  modifiedValue,
  language,
  languageMode,
  filename,
  onLanguagesChange,
  theme: requestedTheme = "vs-light",
  settingsBarTarget,
  languageBarTarget,
  height = "100%",
  customQuickPrompts,
  showTimestampDecorators = true,
  showBase64Decorators = true,
  showUnicodeDecorators = true,
  showUrlDecorators = true,
  showImageDecorators = true,
  onUpdateOriginalValue,
  onUpdateModifiedValue,
  onMount,
  ref,
}: MonacoDiffEditorProps) {
  const theme = getMonacoTheme(requestedTheme);
  const context = useContext(ToolContext);
  const owner = context || tabKey;
  const key = context ? `${context}::${tabKey}` : tabKey;
  const root = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null);
  const diff = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const callbacks = useRef({ onUpdateOriginalValue, onUpdateModifiedValue });
  callbacks.current = { onUpdateOriginalValue, onUpdateModifiedValue };
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [promptOpen, setPromptOpen] = useState(false),
    [prompt, setPrompt] = useState(""),
    [assistant, setAssistant] = useState(false);
  const showBusy = useDelayedVisibility(busy);
  const [snapshot, setSnapshot] = useState("");
  const [candidate, setCandidate] = useState<string | null>(null);
  const [candidateVersion, setCandidateVersion] = useState(0);
  const [candidateSide, setCandidateSide] = useState(Side.right);
  const [localMode, setMode] = useState<LanguageMode>(
    languageMode || (language ? "manual" : "auto"),
  );
  const [manualLanguage, setManualLanguage] = useState(language || "json");
  const mode = context
    ? localMode
    : languageMode || (language ? "manual" : "auto");
  const selectedLanguage = context ? manualLanguage : language || "json";
  const currentLanguage = useDataLanguage(
    originalValue,
    selectedLanguage,
    mode,
    filename,
    key + ":original",
  );
  const modifiedLanguage = useDataLanguage(
    modifiedValue,
    selectedLanguage,
    mode,
    undefined,
    key + ":modified",
  );
  useEffect(() => {
    onLanguagesChange?.({ left: currentLanguage, right: modifiedLanguage });
  }, [currentLanguage, modifiedLanguage, onLanguagesChange]);
  function setLanguage(next: string) {
    if (!context) {
      useTabStore.getState().updateEditorSettings(owner, {
        languageMode: next === "auto" ? "auto" : "manual",
        ...(next === "auto" ? {} : { language: next }),
      });
      return;
    }
    setMode(next === "auto" ? "auto" : "manual");
    if (next !== "auto") setManualLanguage(next);
  }
  const stored = useTabStore.getState().getTabByKey(owner)?.editorSettings;
  const [fontSize, setFontSize] = useState(stored?.fontSize || 14);
  const indentation = useEditorIndentation(owner, ready, () =>
    diff.current
      ? [
          diff.current.getOriginalEditor().getModel()!,
          diff.current.getModifiedEditor().getModel()!,
        ]
      : [],
  );
  const { indentSize: indent } = indentation;
  const [enabled, setEnabled] = useState<Record<DecoderKind, boolean>>({
    timestamp: stored?.timestampDecoratorsEnabled ?? showTimestampDecorators,
    base64: stored?.base64DecoratorsEnabled ?? showBase64Decorators,
    unicode: stored?.unicodeDecoratorsEnabled ?? showUnicodeDecorators,
    url: stored?.urlDecoratorsEnabled ?? showUrlDecorators,
    image: stored?.imageDecoratorsEnabled ?? showImageDecorators,
  });
  const flags = useRef(enabled);
  flags.current = enabled;
  const promptRef = useRef<PromptContainerRef>(null),
    pending = useRef(""),
    panel = useRef<ImperativePanelHandle>(null);
  const [messages, setMessages] = useToolState<
    Array<{ role: "user" | "assistant"; content: string; timestamp: number }>
  >(key + ":aiMessages", []);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 768);
  const editors = (side = Side.all) =>
    !diff.current
      ? []
      : side === Side.left
        ? [diff.current.getOriginalEditor()]
        : side === Side.right
          ? [diff.current.getModifiedEditor()]
          : [
              diff.current.getOriginalEditor(),
              diff.current.getModifiedEditor(),
            ];
  const apply = (side: Side, text: string) => {
    for (const ed of editors(side)) createEditorAdapter(key, ed).apply(text);
  };
  function toggle(kind: DecoderKind, value?: boolean) {
    const next = value ?? !flags.current[kind];
    setEnabled((prev) => ({ ...prev, [kind]: next }));
    return next;
  }
  function showAI() {
    const [left, right] = editors();
    setSnapshot(
      `原始文件：\n${left?.getValue() || ""}\n对比内容：\n${right?.getValue() || ""}`,
    );
    setPromptOpen(true);
  }
  function process(
    action: "format" | "sort",
    side = Side.all,
    direction: "asc" | "desc" = "asc",
  ) {
    const targets = editors(side);
    if (!targets.length) return false;
    if (
      targets.some(
        (ed) =>
          !(action === "format" ? supportsFormatting : supportsJsonOperations)(
            ed.getModel()?.getLanguageId() || "",
          ),
      )
    )
      return false;
    setBusy(true);
    void Promise.all(
      targets.map(async (ed) => {
        const model = ed.getModel();
        if (!model) return;
        const language = model.getLanguageId();
        const options = indentation.resolve(model);
        if (action === "format" && !supportsJsonOperations(language)) {
          await formatEditorDocument(ed);
          return;
        }
        const version = model.getVersionId();
        const result = await runJsonTask(key + ":" + ed.getId(), {
          action,
          content: model.getValue(),
          language: model.getLanguageId(),
          indent: options.tabSize,
          insertSpaces: options.insertSpaces,
          direction,
        });
        if (model.isDisposed()) return;
        if (
          model.getVersionId() !== version ||
          model.getLanguageId() !== language
        ) {
          toast.warning("内容已变化，请重新执行");
          return;
        }
        if (result.content !== undefined)
          createEditorAdapter(key, ed).apply(result.content);
      }),
    )
      .catch((error) => {
        if (error.name !== "AbortError") toast.error("处理失败", error.message);
      })
      .finally(() => setBusy(false));
    return true;
  }
  useImperativeHandle(ref, () => ({
    focus: () => diff.current?.getOriginalEditor().focus(),
    layout: () => diff.current?.layout(),
    updateOriginalValue: (text) => apply(Side.left, text),
    updateModifiedValue: (text) => apply(Side.right, text),
    clear: (side = Side.all) => {
      apply(side, "");
      return true;
    },
    copy: (side = Side.all) => {
      void clipboard.copy(
        editors(side)
          .map((ed) => ed.getValue())
          .join("\n\n"),
        "已复制",
      );
      return true;
    },
    format: (side = Side.all) => process("format", side),
    fieldSort: (side = Side.all, direction = "asc") =>
      process("sort", side, direction),
    showAiPrompt: showAI,
    toggleTimestampDecorators: (v) => toggle("timestamp", v),
    toggleBase64Decorators: (v) => toggle("base64", v),
    toggleUnicodeDecorators: (v) => toggle("unicode", v),
    toggleUrlDecorators: (v) => toggle("url", v),
    toggleImageDecorators: (v) => toggle("image", v),
  }));
  useEffect(() => {
    let disposed = false;
    let instance: monaco.editor.IStandaloneDiffEditor | undefined;
    const subscriptions: monaco.IDisposable[] = [];
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    void initMonacoGlobally().then(() => {
      if (disposed || !host.current) return;
      instance = monaco.editor.createDiffEditor(host.current, {
        automaticLayout: true,
        theme,
        fontSize,
        originalEditable: true,
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        wordWrap: "on",
        lineNumbersMinChars: 3,
        ignoreTrimWhitespace: false,
      });
      diff.current = instance;
      instance.setModel({
        original: getDocumentModel(key, originalValue, currentLanguage),
        modified: getDocumentModel(
          key + "::diff",
          modifiedValue,
          modifiedLanguage,
        ),
      });
      for (const [index, ed] of [
        instance.getOriginalEditor(),
        instance.getModifiedEditor(),
      ].entries()) {
        restoreEditorView(index ? key + "::diff" : key, ed);
        const refresh = () => {
          clearTimeout(timers.get(ed.getId()));
          timers.set(
            ed.getId(),
            setTimeout(() => {
              if (disposed) return;
              for (const [kind, on] of Object.entries(flags.current))
                updateDecoder(kind as DecoderKind, ed, { enabled: on });
            }, 120),
          );
        };
        subscriptions.push(
          ed.onDidChangeModelContent(() => {
            if (index) callbacks.current.onUpdateModifiedValue?.(ed.getValue());
            else callbacks.current.onUpdateOriginalValue(ed.getValue());
            refresh();
          }),
          ed.onDidScrollChange(refresh),
        );
        refresh();
      }
      setReady(true);
      onMount?.();
    });
    return () => {
      disposed = true;
      subscriptions.forEach((s) => s.dispose());
      timers.forEach(clearTimeout);
      if (instance) {
        for (const [index, ed] of [
          instance.getOriginalEditor(),
          instance.getModifiedEditor(),
        ].entries()) {
          saveEditorView(index ? key + "::diff" : key, ed);
          clearEditorDecoders(ed);
          cancelJsonTask(key + ":" + ed.getId());
        }
        instance.dispose();
      }
      diff.current = null;
    };
  }, [key]);
  useEffect(() => {
    if (ready) {
      apply(Side.left, originalValue);
      apply(Side.right, modifiedValue);
    }
  }, [originalValue, modifiedValue, ready]);
  useEffect(() => {
    monaco.editor.setTheme(theme);
    diff.current?.updateOptions({ fontSize });
    for (const [index, ed] of editors().entries()) {
      ed.updateOptions({ fontSize });
      const model = ed.getModel();
      if (model)
        monaco.editor.setModelLanguage(
          model,
          index ? modifiedLanguage : currentLanguage,
        );
      for (const [kind, on] of Object.entries(enabled))
        updateDecoder(kind as DecoderKind, ed, { enabled: on });
    }
  }, [theme, fontSize, currentLanguage, modifiedLanguage, enabled, ready]);
  useEffect(() => {
    if (context && language) setManualLanguage(language);
  }, [language, context]);
  useEffect(() => {
    if (context && languageMode) setMode(languageMode);
  }, [languageMode, context]);
  useEffect(() => {
    useTabStore.getState().updateEditorSettings(owner, {
      fontSize,
      ...(!context ? { language: currentLanguage, languageMode: mode } : {}),
      timestampDecoratorsEnabled: enabled.timestamp,
      base64DecoratorsEnabled: enabled.base64,
      unicodeDecoratorsEnabled: enabled.unicode,
      urlDecoratorsEnabled: enabled.url,
      imageDecoratorsEnabled: enabled.image,
    });
  }, [owner, fontSize, currentLanguage, mode, enabled, context]);
  useEffect(() => {
    const resize = () => setNarrow(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (assistant) {
      if (!narrow) panel.current?.resize(38);
      else panel.current?.collapse();
    } else panel.current?.collapse();
  }, [assistant, narrow]);
  const assistantContent = assistant && (
    <div className="ai-surface ai-dock flex h-full min-h-0 flex-col">
      <AIAssistantHeader
        fileName={tabTitle || "对比快照"}
        contextLabel="上下文 · 对比快照"
        onClose={() => setAssistant(false)}
      />
      <div className="min-h-0 flex-1">
        <PromptContainer
          ref={(node) => {
            promptRef.current = node;
            if (node && pending.current)
              setTimeout(() => {
                if (promptRef.current && pending.current) {
                  const text = pending.current;
                  pending.current = "";
                  promptRef.current.sendMessage(text);
                }
              }, 0);
          }}
          initialMessages={messages}
          onMessagesChange={setMessages}
          editorContent={snapshot}
          useDirectApi
          isDiffEditor
          onApplyCodeToLeft={(code) => {
            setCandidateSide(Side.left);
            setCandidate(code);
            setCandidateVersion(
              diff.current?.getOriginalEditor().getModel()?.getVersionId() || 0,
            );
          }}
          onApplyCodeToRight={(code) => {
            setCandidateSide(Side.right);
            setCandidate(code);
            setCandidateVersion(
              diff.current?.getModifiedEditor().getModel()?.getVersionId() || 0,
            );
          }}
        />
      </div>
    </div>
  );
  return (
    <div
      ref={root}
      className="relative flex h-full min-h-0 flex-col"
      style={{ height }}
    >
      {showBusy && (
        <div className="flex items-center justify-between border-b bg-accent px-3 py-1 text-xs">
          正在后台处理…
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              editors().forEach((ed) => cancelJsonTask(key + ":" + ed.getId()))
            }
          >
            取消
          </Button>
        </div>
      )}
      <PanelGroup
        direction={narrow ? "vertical" : "horizontal"}
        className="min-h-0 flex-1"
      >
        <Panel minSize={25}>
          <div className="relative h-full">
            <div ref={host} className="h-full" />
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
              timestampDecoratorsEnabled={enabled.timestamp}
              onTimestampDecoratorsChange={(v) => toggle("timestamp", v)}
              imageDecoratorsEnabled={enabled.image}
              onImageDecoratorsChange={(v) => toggle("image", v)}
              onReset={() => {
                setFontSize(14);
                indentation.reset();
              }}
            />
          </div>
        </Panel>
        <PanelResizeHandle
          className={
            assistant ? (narrow ? "h-1 bg-border" : "w-1 bg-border") : "hidden"
          }
        />
        <Panel
          ref={panel}
          defaultSize={0}
          collapsedSize={0}
          collapsible
          minSize={20}
        >
          {!narrow && assistantContent}
        </Panel>
      </PanelGroup>
      {languageBarTarget === undefined ? (
        <div className="editor-local-status">
          <LanguageSelector
            language={currentLanguage}
            languageMode={mode}
            onLanguageChange={setLanguage}
          />
        </div>
      ) : languageBarTarget ? (
        createPortal(
          <LanguageSelector
            language={currentLanguage}
            languageMode={mode}
            onLanguageChange={setLanguage}
          />,
          languageBarTarget,
        )
      ) : null}
      {narrow && (
        <Sheet open={assistant} onOpenChange={setAssistant} title="AI 助手">
          {assistantContent}
        </Sheet>
      )}
      <AIPromptOverlay
        isOpen={promptOpen}
        prompt={prompt}
        onPromptChange={setPrompt}
        onClose={() => setPromptOpen(false)}
        quickPrompts={customQuickPrompts || diffJsonQuickPrompts}
        onSubmit={() => {
          if (!prompt.trim()) return;
          pending.current = prompt;
          setPrompt("");
          setPromptOpen(false);
          if (assistant && promptRef.current) {
            promptRef.current.sendMessage(pending.current);
            pending.current = "";
          } else setAssistant(true);
        }}
      />
      <Modal isOpen={candidate !== null} onClose={() => setCandidate(null)}>
        <ModalContent>
          <ModalHeader>
            应用至对比{candidateSide === Side.left ? "左" : "右"}侧
          </ModalHeader>
          <ModalBody>
            <DiffPreview
              original={
                candidate === null
                  ? ""
                  : editors(candidateSide)[0]?.getValue() || ""
              }
              modified={candidate || ""}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              结果属于本次对比请求，应用后可撤销。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setCandidate(null)}>取消</Button>
            <Button
              color="primary"
              onPress={() => {
                const current = editors(candidateSide)[0]
                  ?.getModel()
                  ?.getVersionId();
                if (current !== candidateVersion) {
                  setCandidateVersion(current || 0);
                  toast.warning("右侧内容已变化，请重新确认");
                  return;
                }
                apply(candidateSide, candidate || "");
                setCandidate(null);
              }}
            >
              应用
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
