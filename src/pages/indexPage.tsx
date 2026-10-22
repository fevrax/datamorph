import type { TextChange } from "@/store/useTabStore";
import { useTabMetadata } from "@/store/useTabMetadata";
import {
  DocumentActions,
  type DocumentAction,
} from "@/components/workspace/DocumentActions";
import { DiffPreview } from "@/components/workspace/DiffPreview";
import { WorkspaceWelcome } from "@/components/workspace/WorkspaceWelcome";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Braces,
  Network,
  Table2,
  Columns2,
  WandSparkles,
  Copy,
  Download,
  Minimize2,
  ArrowDownAZ,
  ArrowUpAZ,
  ListOrdered,
  CodeXml,
  TextQuote,
  MessageSquareOff,
  Trash2,
  History,
  Sparkles,
  X,
  Upload,
} from "lucide-react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Spinner,
} from "@/components/ui";
import DynamicTabs, { importFiles } from "@/components/dynamicTabs/DynamicTabs";
import MonacoDataEditor, {
  type MonacoDataEditorRef,
} from "@/components/monacoEditor/MonacoDataEditor";
import MonacoDiffEditor, {
  type MonacoDiffEditorRef,
} from "@/components/monacoEditor/MonacoDiffEditor";
import LanguageSelector from "@/components/monacoEditor/LanguageSelector";
import {
  useTabStore,
  downloadRecoveryData,
  type DocumentView,
} from "@/store/useTabStore";
import { useToolboxStore } from "@/store/useToolboxStore";
import { useMonacoInit } from "@/components/monacoEditor/useMonacoInit";
import { getToolComponent } from "@/pages/tools/toolRegistry";
import { ToolContext } from "@/components/workspace/ToolContext";
import TabHistoryModal from "@/components/tabHistory/TabHistoryModal";
import { runJsonTask, cancelJsonTask, type TaskResult } from "@/workers/client";
import type { JsonTask } from "@/workers/jsonTasks";
import type { JsonTableViewRef } from "@/components/jsonTable/JsonTableView";
import { stringifyJson } from "@/utils/json";
import { JsonSample } from "@/utils/jsonSample";
import clipboard from "@/utils/clipboard";
import toast from "@/utils/toast";
import { useDelayedVisibility } from "@/hooks/useDelayedVisibility";
import {
  documentDownloadName,
  supportsJsonOperations,
  supportsFormatting,
} from "@/utils/dataFormats";
const TreeEditor = lazy(
  () => import("@/components/vanillaJsonEditor/VanillaJsonEditor"),
);
const TableView = lazy(() => import("@/components/jsonTable/JsonTableView"));
const Toolbox = lazy(() => import("@/pages/toolboxPage"));
const onTabSwitch = () => {};
const Loading = () => (
  <div className="flex h-full items-center justify-center">
    <Spinner label="正在准备工作区…" />
  </div>
);
export function downloadText(content: string, title: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = title;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ToolResultActions({ tabKey }: { tabKey: string }) {
  const tab = useTabStore((s) => s.getTabByKey(tabKey))!;
  const [preview, setPreview] = useState(false);
  const [baseRevision, setBaseRevision] = useState<number>();
  const source = useTabStore((s) => s.getTabByKey(tab.source?.key || ""));
  const result = String(
    tab.toolState.outputValue ??
      tab.toolState.fixedValue ??
      tab.toolState.encodedText ??
      tab.toolState.jwtToken ??
      "",
  );
  const pendingResult = useRef("");
  const protoResult = tab.kind === "tool" && tab.toolId === "protoSort";
  if (!result) return null;
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {tab.source ? `来源：${tab.source.title}` : "转换结果"}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            onPress={() => void clipboard.copy(result, "已复制结果")}
          >
            复制结果
          </Button>
          <Button
            size="sm"
            onPress={() =>
              downloadText(result, protoResult ? "result.proto" : "result.txt")
            }
          >
            下载
          </Button>
          <Button
            size="sm"
            onPress={() =>
              useTabStore
                .getState()
                .addTab(protoResult ? "result.proto" : "result.json", result)
            }
          >
            新建标签
          </Button>
          {source && (
            <Button
              size="sm"
              color="primary"
              onPress={() => {
                pendingResult.current = result;
                setBaseRevision(source.revision);
                setPreview(true);
              }}
            >
              替换来源…
            </Button>
          )}
        </div>
      </div>
      <Modal isOpen={preview} onClose={() => setPreview(false)} size="5xl">
        <ModalContent>
          <ModalHeader>预览替换 · {source?.title}</ModalHeader>
          <ModalBody>
            <DiffPreview
              original={source?.content || ""}
              modified={pendingResult.current}
            />
            {(source?.revision !== baseRevision ||
              source?.revision !== tab.source?.revision) && (
              <p className="mt-2 text-sm text-warning">
                来源已发生变化，请查看最新差异后再次确认。
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setPreview(false)}>取消</Button>
            <Button
              color="primary"
              isDisabled={!source}
              onPress={() => {
                if (!source) return;
                if (source.revision !== baseRevision) {
                  setBaseRevision(source.revision);
                  return;
                }
                useTabStore
                  .getState()
                  .updateTabContent(source.key, pendingResult.current);
                setPreview(false);
                toast.success("已更新来源文件，可通过历史恢复");
              }}
            >
              {source?.revision !== baseRevision ? "确认最新版本" : "应用替换"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
function DocumentWorkspace({ tabKey }: { tabKey: string }) {
  const tab = useTabStore((s) => s.getTabByKey(tabKey))!;
  const editor = useRef<MonacoDataEditorRef>(null);
  const diff = useRef<MonacoDiffEditorRef>(null);
  const table = useRef<JsonTableViewRef>(null);
  const [history, setHistory] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<HTMLSpanElement | null>(
    null,
  );
  const [statusTarget, setStatusTarget] = useState<HTMLSpanElement | null>(
    null,
  );
  const [languageTarget, setLanguageTarget] = useState<HTMLSpanElement | null>(
    null,
  );
  const [indentationTarget, setIndentationTarget] =
    useState<HTMLSpanElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState(() => !tab.content);
  const showBusy = useDelayedVisibility(busy);
  const [validation, setValidation] = useState<TaskResult>({});
  const [compare, setCompare] = useState(false);
  const [other, setOther] = useState("blank");
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "vs-dark" : "vs-light";
  const store = useTabStore.getState();
  const view = tab.view;
  const jsonSupported = supportsJsonOperations(tab.editorSettings.language);
  const formatSupported = supportsFormatting(tab.editorSettings.language);
  const treeContent = useMemo(() => ({ text: tab.content }), [tab.content]);
  const fileBytes = tab.byteLength;
  const persistence = useSettingsStore((s) => s.persistentDataEnabled);
  const saveStatus = useTabStore((s) => s.saveStatus);
  const storageError = useTabStore((s) => s.storageError);
  const files = useTabMetadata();
  const viewList: [DocumentView, string, typeof Braces][] = [
    ["code", "编辑", Braces],
    ["tree", "树形", Network],
    ["table", "表格", Table2],
  ];
  const update = useCallback(
    (content: string, changes?: readonly TextChange[]) =>
      useTabStore.getState().updateTabContent(tab.key, content, changes),
    [tab.key],
  );
  useEffect(() => {
    const scope = "validate:" + tab.key;
    const revision = tab.revision;
    const validatingLanguage = tab.editorSettings.language;
    setValidation({});
    if (!jsonSupported) return () => cancelJsonTask(scope);
    const timer = setTimeout(
      () => {
        void runJsonTask(scope, {
          action: "validate",
          content: tab.content,
          language: tab.editorSettings.language,
        })
          .then((result) => {
            if (
              useTabStore.getState().getTabByKey(tab.key)?.revision ===
                revision &&
              useTabStore.getState().getTabByKey(tab.key)?.editorSettings
                .language === validatingLanguage
            )
              setValidation(result);
          })
          .catch(() => {});
      },
      tab.content.length > 1_000_000 ? 1000 : 400,
    );
    return () => {
      clearTimeout(timer);
      cancelJsonTask(scope);
    };
  }, [tab.content, tab.revision, tab.key, tab.editorSettings.language]);
  useEffect(() => {
    return () => cancelJsonTask("action:" + tab.key);
  }, [tab.key, view]);
  async function action(
    action: JsonTask | "renumber-proto",
    direction?: "asc" | "desc",
  ) {
    const language = tab.editorSettings.language;
    if (action === "renumber-proto" ? language !== "proto" : !jsonSupported)
      return;
    const revision = tab.revision;
    setBusy(true);
    try {
      const result = await runJsonTask("action:" + tab.key, {
        action,
        content: tab.content,
        indent: tab.editorSettings.indentSize,
        insertSpaces: tab.editorSettings.insertSpaces,
        language: tab.editorSettings.language,
        direction,
      });
      const current = store.getTabByKey(tab.key);
      if (
        current?.revision !== revision ||
        current?.editorSettings.language !== language
      ) {
        toast.warning("内容已变化，请重新执行操作");
        return;
      }
      if (result.content !== undefined) {
        if (editor.current) editor.current.updateValue(result.content);
        else update(result.content);
        setWelcome(false);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        toast.error("处理失败", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tableCopy = (type?: "default" | "node" | "path") => {
    const value =
      type === "path"
        ? table.current?.getSelectedPath()
        : type === "node"
          ? stringifyJson(table.current?.getSelectedNode() ?? null)
          : tab.content;
    void clipboard.copy(value ?? "", "已复制");
    return true;
  };
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex shrink-0 items-center gap-1 rounded-md bg-secondary/60 p-0.5">
          {viewList
            .filter(([id]) => id === "code" || jsonSupported)
            .map(([id, label, Icon]) => (
              <Button
                key={id}
                size="sm"
                variant="ghost"
                className={
                  view === id ? "bg-background text-primary shadow-xs" : ""
                }
                aria-pressed={view === id}
                onPress={() => store.setView(tab.key, id)}
              >
                <Icon />
                {label}
              </Button>
            ))}
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={view === "diff"}
            className={
              view === "diff" ? "bg-background text-primary shadow-xs" : ""
            }
            onPress={() => setCompare(true)}
          >
            <Columns2 />
            对比
          </Button>
        </div>
        <DocumentActions
          endContent={
            view === "code" || view === "diff" ? (
              <span
                ref={setSettingsTarget}
                className="flex shrink-0 items-center"
              />
            ) : undefined
          }
          actions={[
            {
              key: "ai",
              label: "AI 助手",
              icon: Sparkles,
              onPress: () => {
                setWelcome(false);
                if (view === "diff") diff.current?.showAiPrompt();
                else {
                  if (view !== "code") store.setView(tab.key, "code");
                  setTimeout(() => editor.current?.showAiPrompt(), 100);
                }
              },
            },
            ...(view !== "diff" && formatSupported
              ? [
                  {
                    key: "format",
                    label: "格式化",
                    icon: WandSparkles,
                    disabled: busy,
                    onPress: () => {
                      if (view === "code") {
                        editor.current?.format();
                        setWelcome(false);
                      } else void action("format");
                    },
                  },
                ]
              : []),
            ...(view === "code" && tab.editorSettings.language === "proto"
              ? [
                  {
                    key: "renumber-proto",
                    label: "重新排序编号",
                    icon: ListOrdered,
                    disabled: busy || !tab.content.trim(),
                    onPress: () => void action("renumber-proto"),
                  },
                ]
              : []),
            ...(view !== "diff"
              ? [
                  {
                    key: "copy",
                    label: "复制",
                    icon: Copy,
                    onPress: () => void clipboard.copy(tab.content, "已复制"),
                  },
                ]
              : []),
            {
              key: "clear",
              label: "清空",
              icon: Trash2,
              onPress: () => {
                if (editor.current) editor.current.clear();
                else update("");
                setWelcome(true);
              },
            },
            ...(jsonSupported
              ? (
                  [
                    ["压缩", "compress", Minimize2],
                    ["字段升序", "sort", ArrowDownAZ],
                    ["字段降序", "sort-desc", ArrowUpAZ],
                    ["转义", "escape", CodeXml],
                    ["删除转义", "unescape", TextQuote],
                    ["删除注释", "comments", MessageSquareOff],
                  ] as const
                ).map(
                  ([label, key, icon]): DocumentAction => ({
                    key,
                    label,
                    icon,
                    disabled: busy,
                    onPress: () =>
                      void action(
                        key === "sort-desc" ? "sort" : key,
                        key === "sort-desc" ? "desc" : "asc",
                      ),
                  }),
                )
              : []),
            {
              key: "download",
              label: "下载",
              icon: Download,
              onPress: () =>
                downloadText(
                  tab.content,
                  documentDownloadName(
                    tab.title,
                    tab.editorSettings.language,
                    tab.editorSettings.filename,
                  ),
                ),
            },
            {
              key: "history",
              label: "历史",
              icon: History,
              onPress: () => setHistory(true),
            },
          ]}
        />
      </div>
      {showBusy && (
        <div className="flex items-center justify-between border-b bg-accent px-3 py-1 text-xs">
          <Spinner size="sm" label="正在后台处理…" />
          <Button
            size="sm"
            variant="ghost"
            onPress={() => cancelJsonTask("action:" + tab.key)}
          >
            <X />
            取消
          </Button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<Loading />}>
          {view === "code" && (
            <WorkspaceWelcome
              active={welcome}
              title={tab.title}
              hasContent={!!tab.content.trim()}
              busy={busy}
              onFocus={() => editor.current?.focus()}
              onSample={() => {
                if (editor.current) editor.current.updateValue(JsonSample);
                else update(JsonSample);
                setWelcome(false);
              }}
              onStart={() => {
                setWelcome(false);
                editor.current?.focus();
              }}
              onContinue={() => {
                setWelcome(false);
                editor.current?.focus();
              }}
            >
              <MonacoDataEditor
                ref={editor}
                tabKey={tab.key}
                tabTitle={tab.title}
                documentId={tab.key}
                language={tab.editorSettings.language}
                languageMode={tab.editorSettings.languageMode}
                filename={tab.editorSettings.filename}
                theme={theme}
                height="100%"
                isMenu
                settingsBarTarget={settingsTarget}
                showJsonPathFilter={!welcome}
                statusBarTarget={statusTarget}
                languageBarTarget={languageTarget}
                indentationBarTarget={indentationTarget}
                onUpdateValue={update}
              />
            </WorkspaceWelcome>
          )}
          {view === "tree" && (
            <TreeEditor
              tabKey={tab.key}
              content={treeContent}
              onUpdateValue={(value) =>
                update(
                  "text" in value
                    ? value.text
                    : stringifyJson(value.json, tab.editorSettings.indentSize),
                )
              }
            />
          )}{" "}
          {view === "table" && (
            <TableView
              ref={table}
              data={tab.content}
              onDataUpdate={update}
              onCopy={tableCopy}
            />
          )}{" "}
          {view === "diff" && (
            <MonacoDiffEditor
              ref={diff}
              settingsBarTarget={settingsTarget}
              languageBarTarget={languageTarget}
              indentationBarTarget={indentationTarget}
              tabKey={tab.key}
              tabTitle={tab.title}
              originalValue={tab.content}
              modifiedValue={tab.diffModifiedValue || ""}
              language={tab.editorSettings.language}
              languageMode={tab.editorSettings.languageMode}
              filename={tab.editorSettings.filename}
              theme={theme}
              onUpdateOriginalValue={update}
              onUpdateModifiedValue={(text) =>
                store.setTabModifiedValue(tab.key, text)
              }
            />
          )}
        </Suspense>
      </div>
      <div className="workbench-status">
        <div className="status-document">
          <button
            className={
              validation.error
                ? "text-destructive"
                : tab.content
                  ? "text-success"
                  : "text-muted-foreground"
            }
            onClick={() => {
              if (validation.error) {
                const { line, column } = validation.error;
                store.setView(tab.key, "code");
                setTimeout(
                  () =>
                    window.dispatchEvent(
                      new CustomEvent("datamorph:reveal", {
                        detail: {
                          key: tab.key,
                          line,
                          column,
                        },
                      }),
                    ),
                  100,
                );
              }
            }}
          >
            {validation.error
              ? `错误 · ${validation.error.line}:${validation.error.column}`
              : tab.content
                ? ["json", "json5"].includes(tab.editorSettings.language)
                  ? "✓ JSON 有效"
                  : `${tab.editorSettings.language.toUpperCase()} · 未校验`
                : "等待输入"}
          </button>
          <button
            type="button"
            className={storageError ? "truncate text-destructive" : "truncate"}
            title={
              storageError ||
              (persistence ? "文档自动保存到本地" : "仅在当前窗口保存")
            }
            onClick={() => {
              if (storageError) void downloadRecoveryData();
            }}
          >
            {storageError
              ? "保存失败 · 请下载备份"
              : !persistence
                ? "仅在当前窗口保存"
                : saveStatus === "saving"
                  ? "正在保存…"
                  : saveStatus === "saved"
                    ? "已保存"
                    : ""}
          </button>
        </div>
        <div className="status-details">
          <span ref={setStatusTarget} className="status-cursor" />
          <span
            className="status-character-count"
            title={`总字符数：${tab.content.length.toLocaleString()}`}
          >
            {tab.content.length.toLocaleString()} 字符
          </span>
          <span
            className="status-file-size"
            title={`${fileBytes.toLocaleString()} 字节 · UTF-8`}
          >
            {fileBytes < 1024
              ? `${fileBytes} B`
              : fileBytes < 1048576
                ? `${(fileBytes / 1024).toFixed(1)} KB`
                : `${(fileBytes / 1048576).toFixed(1)} MB`}
          </span>
          <span key={view} ref={setLanguageTarget} className="inline-flex">
            {(view === "tree" || view === "table") && (
              <LanguageSelector
                language={tab.editorSettings.language}
                languageMode={tab.editorSettings.languageMode}
                onLanguageChange={(language) =>
                  store.updateEditorSettings(tab.key, {
                    languageMode: language === "auto" ? "auto" : "manual",
                    ...(language === "auto" ? {} : { language }),
                  })
                }
              />
            )}
          </span>
          <span
            key={`indentation-${view}`}
            ref={setIndentationTarget}
            className="status-secondary inline-flex"
          >
            {(view === "tree" || view === "table") && (
              <>
                {tab.editorSettings.indentMode !== "manual" && "自动 · "}
                {tab.editorSettings.insertSpaces === false
                  ? `Tab · 宽度 ${tab.editorSettings.indentSize}`
                  : `${tab.editorSettings.indentSize} 空格`}
              </>
            )}
          </span>
        </div>
      </div>
      {history && (
        <TabHistoryModal
          isOpen={history}
          onClose={() => setHistory(false)}
          documentTitle={tab.title}
          language={tab.editorSettings.language}
          languageMode={tab.editorSettings.languageMode}
          filename={tab.editorSettings.filename}
          currentContent={tab.content}
          historyItems={tab.history}
          onRestore={(id) => {
            store.restoreTabHistory(tab.key, id);
            toast.success("已恢复历史版本");
          }}
          onOpenInNewTab={(item) => {
            const title = item.title || tab.title;
            const extension = title.lastIndexOf(".");
            store.addTab(
              extension > 0
                ? `${title.slice(0, extension)} · 历史版本${title.slice(extension)}`
                : `${title} · 历史版本`,
              item.content,
            );
            store.updateEditorSettings(useTabStore.getState().activeTabKey, {
              language: tab.editorSettings.language,
            });
          }}
          onDelete={(id) => store.deleteTabHistory(tab.key, id)}
          onClear={() => store.clearTabHistory(tab.key)}
        />
      )}
      <Modal isOpen={compare} onClose={() => setCompare(false)}>
        <ModalContent>
          <ModalHeader>选择比较对象</ModalHeader>
          <ModalBody>
            <Select
              aria-label="比较对象"
              selectedKeys={[other]}
              onChange={(e) => setOther(e.target.value)}
            >
              <SelectItem key="blank">空白内容，手动粘贴</SelectItem>
              {files
                .filter((f) => f.kind === "document" && f.key !== tab.key)
                .map((f) => (
                  <SelectItem key={f.key}>{f.title}</SelectItem>
                ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setCompare(false)}>取消</Button>
            <Button
              color="primary"
              onPress={() => {
                store.setTabModifiedValue(
                  tab.key,
                  other === "blank"
                    ? tab.diffModifiedValue || ""
                    : store.getTabByKey(other)?.content || "",
                );
                store.setView(tab.key, "diff");
                setCompare(false);
              }}
            >
              开始对比
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
export default function IndexPage() {
  const ready = useMonacoInit();
  const hydrated = useTabStore((s) => s.hydrated);
  const key = useTabStore((s) => s.activeTabKey);
  useTabStore((s) => s.getTabByKey(key)?.kind);
  useTabStore((s) => {
    const tab = s.getTabByKey(key);
    return tab?.kind === "tool" ? tab.toolId : undefined;
  });
  const tab = useTabStore.getState().getTabByKey(key);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { toolId } = useParams();
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    void useTabStore.getState().syncTabStore();
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (toolId) {
      const tool = useToolboxStore
        .getState()
        .tools.find((t) => t.id === toolId);
      if (tool) useTabStore.getState().addToolTab(tool);
      navigate("/", { replace: true });
    } else if (pathname === "/toolbox") useTabStore.getState().openToolboxTab();
  }, [hydrated, toolId, pathname]);
  const Component = tab?.kind === "tool" ? getToolComponent(tab.toolId) : null;
  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void importFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <DynamicTabs onSwitch={onTabSwitch} />
      {!hydrated || !ready ? (
        <Loading />
      ) : tab?.kind === "document" ? (
        <DocumentWorkspace key={tab.key} tabKey={tab.key} />
      ) : (
        <Suspense fallback={<Loading />}>
          {tab?.kind === "toolbox" ? (
            <Toolbox />
          ) : tab && Component ? (
            <ToolContext.Provider value={tab.key}>
              <div className="min-h-0 flex-1">
                <Component key={tab.key} />
              </div>
              <ToolResultActions tabKey={tab.key} />
            </ToolContext.Provider>
          ) : (
            <div className="p-8 text-muted-foreground">未找到工具</div>
          )}
        </Suspense>
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed border-primary bg-background/90 text-primary">
          <Upload className="mr-3 size-6" />
          释放文件以导入
        </div>
      )}
    </div>
  );
}
