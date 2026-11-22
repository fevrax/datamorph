import { errorText } from "@/i18n/diagnostics";
import { t } from "@/i18n";
import { useLocale } from "@/i18n/useLocale";
import { getTabDisplayTitle, useTabMetadata } from "@/store/useTabMetadata";
import { memo, useEffect, useRef, useState, useImperativeHandle } from "react";
import { ContextMenu } from "radix-ui";
import {
  Plus,
  X,
  Braces,
  Blocks,
  ChevronDown,
  Upload,
  Link,
  Binary,
  FilePlus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import { useTabStore } from "@/store/useTabStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { globalShortcutListener } from "@/utils/shortcut";
import { validateAndDecodeBase64 } from "@/utils/base64";
import { JsonSample } from "@/utils/jsonSample";
import toast from "@/utils/toast";
import { DATA_FILE_ACCEPT } from "@/utils/dataFormats";
import { useNamingTabKeys } from "@/services/tabAutoNaming";
import {
  WorkspaceNavigationTrigger,
  WorkspaceSearchTrigger,
} from "@/components/workspace/WorkspaceActions";
export interface DynamicTabsRef {
  getPositionTop: () => number;
  openImportDialog: (type: "url" | "base64") => void;
}
export interface DynamicTabsProps {
  ref?: React.Ref<DynamicTabsRef>;
  onSwitch: (key: string) => void;
  onClose?: (keys: string[]) => void;
  onUrlRefresh?: (key: string) => void;
}
export async function importFiles(files: File[]) {
  for (const file of files) {
    try {
      useTabStore.getState().addTab(file.name, await file.text());
    } catch (error) {
      toast.error(t("无法读取文件"), errorText(error));
    }
  }
}
function DynamicTabs({
  ref,
  onSwitch,
  onClose,
  onUrlRefresh,
}: DynamicTabsProps) {
  useLocale();
  const tabs = useTabMetadata();
  const namingTabs = useNamingTabKeys();
  const active = useTabStore((s) => s.activeTabKey);
  const { newTabShortcut, closeTabShortcut } = useSettingsStore();
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<
    "url" | "base64" | "rename" | "refresh" | null
  >(null);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const store = useTabStore.getState();
  useImperativeHandle(
    ref,
    () => ({
      getPositionTop: () => root.current?.getBoundingClientRect().bottom || 0,
      openImportDialog: (type) => open(type),
    }),
    [],
  );
  useEffect(() => {
    onSwitch(active);
    root.current
      ?.querySelector("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  useEffect(() => {
    const list = root.current?.querySelector('[role="tablist"]');
    if (!list) return;
    const observer = new ResizeObserver(() => {
      list
        .querySelector("[aria-selected=true]")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const add = () => store.addTab();
    const close = () => {
      const key = useTabStore.getState().activeTabKey;
      store.closeTab(key);
      onClose?.([key]);
    };
    globalShortcutListener.addListener(newTabShortcut, add, { global: true });
    globalShortcutListener.addListener(closeTabShortcut, close, {
      global: true,
    });
    return () => {
      globalShortcutListener.removeListener(newTabShortcut, add, {
        global: true,
      });
      globalShortcutListener.removeListener(closeTabShortcut, close, {
        global: true,
      });
    };
  }, [newTabShortcut, closeTabShortcut]);
  useEffect(() => () => request.current?.abort(), []);
  const open = (type: typeof dialog, key = "") => {
    setTarget(key);
    const targetTab = store.getTabByKey(key);
    setInput(
      type === "rename"
        ? targetTab
          ? getTabDisplayTitle(targetTab)
          : ""
        : type === "refresh"
          ? String(targetTab?.extraData?.url || "")
          : "",
    );
    setDialog(type);
  };
  async function submit() {
    try {
      if (dialog === "rename") {
        store.renameTab(target, input);
        setDialog(null);
        return;
      }
      if (dialog === "base64") {
        const result = validateAndDecodeBase64(input);
        if (!result.success) throw new Error(result.error || t("Base64 无效"));
        store.addTab("decoded.json", result.decoded);
        setDialog(null);
        return;
      }
      setBusy(true);
      const url = new URL(input);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error(t("请输入 HTTP 或 HTTPS 地址"));
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const before = store.getTabByKey(target);
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (dialog === "refresh" && before) {
        const latest = store.getTabByKey(target);
        if (latest?.revision === before.revision) {
          store.updateTabContent(target, text);
          onUrlRefresh?.(target);
        } else {
          store.addTab(`${before.title} · 最新数据`, text, { url: input });
          toast.warning(t("原文件已变化，已在新标签打开最新数据"));
        }
      } else
        store.addTab(url.pathname.split("/").pop() || "remote.json", text, {
          url: input,
        });
      setDialog(null);
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        toast.error(t("操作失败"), errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      ref={root}
      className="workspace-tab-bar flex min-h-10 shrink-0 items-center border-b bg-muted/50"
    >
      <WorkspaceNavigationTrigger />
      <Button
        isIconOnly
        variant="ghost"
        aria-label={t("新建文档")}
        className="mx-1"
        onPress={() => store.addTab()}
      >
        <Plus />
      </Button>
      <input
        ref={file}
        type="file"
        multiple
        accept={DATA_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void importFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <div
        role="tablist"
        aria-label={t("工作区标签")}
        className="flex min-w-0 flex-1 self-stretch overflow-x-auto"
      >
        {tabs.map((tab) => (
          <ContextMenu.Root key={tab.key}>
            <ContextMenu.Trigger asChild>
              <div
                className={`group relative flex min-w-28 max-w-52 shrink-0 items-center gap-2 border-r px-3 text-xs ${active === tab.key ? "border-t-2 border-t-primary bg-background text-foreground" : "border-t-2 border-t-transparent text-muted-foreground hover:bg-secondary"}`}
              >
                <button
                  role="tab"
                  aria-selected={active === tab.key}
                  onClick={() => store.setActiveTab(tab.key)}
                  onDoubleClick={() => open("rename", tab.key)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2.5"
                >
                  {tab.kind === "document" ? (
                    namingTabs.has(tab.key) ? (
                      <Sparkles
                        aria-hidden="true"
                        className="size-3.5 shrink-0 animate-pulse text-primary"
                      />
                    ) : (
                      <Braces
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-primary"
                      />
                    )
                  ) : (
                    <Blocks aria-hidden="true" className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{tab.title}</span>
                </button>
                {Boolean(tab.extraData?.url) && (
                  <button
                    aria-label={t("刷新 {0}", { 0: tab.title })}
                    onClick={() => open("refresh", tab.key)}
                    className="rounded p-0.5 hover:bg-accent"
                  >
                    <RefreshCw className="size-3" />
                  </button>
                )}
                <button
                  aria-label={t("关闭 {0}", { 0: tab.title })}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => {
                    store.closeTab(tab.key);
                    onClose?.([tab.key]);
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="z-50 min-w-40 rounded-lg border bg-popover p-1 text-[13px] shadow-lg">
                {[
                  [t("重命名"), () => open("rename", tab.key)],
                  [
                    t("关闭"),
                    () => {
                      store.closeTab(tab.key);
                      onClose?.([tab.key]);
                    },
                  ],
                  [
                    t("关闭其他标签"),
                    () => {
                      const closed = store.closeOtherTabs(tab.key);
                      onClose?.(closed);
                    },
                  ],
                  [
                    t("关闭左侧标签"),
                    () => {
                      const closed = store.closeLeftTabs(tab.key);
                      onClose?.(closed);
                    },
                  ],
                  [
                    t("关闭右侧标签"),
                    () => {
                      const closed = store.closeRightTabs(tab.key);
                      onClose?.(closed);
                    },
                  ],
                  [
                    t("关闭全部标签"),
                    () => {
                      const closed = store.closeAllTabs();
                      onClose?.(closed);
                    },
                  ],
                ].map(([label, action]) => (
                  <ContextMenu.Item
                    key={String(label)}
                    onSelect={action as () => void}
                    className="cursor-default rounded px-2 py-1.5 outline-none focus:bg-accent"
                  >
                    {String(label)}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        ))}
      </div>
      <div className="workspace-tab-actions flex shrink-0 items-center gap-1 px-1">
        <WorkspaceSearchTrigger />
        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly variant="ghost" aria-label={t("导入与新建")}>
              <ChevronDown />
            </Button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem
              startContent={<FilePlus className="size-4" />}
              onPress={() => store.addTab()}
            >
              {t("空白文档")}
            </DropdownItem>
            <DropdownItem
              startContent={<Upload className="size-4" />}
              onPress={() => file.current?.click()}
            >
              {t("导入文件")}
            </DropdownItem>
            <DropdownItem
              startContent={<Link className="size-4" />}
              onPress={() => open("url")}
            >
              {t("从 URL 导入")}
            </DropdownItem>
            <DropdownItem
              startContent={<Binary className="size-4" />}
              onPress={() => open("base64")}
            >
              {t("从 Base64 导入")}
            </DropdownItem>
            <DropdownItem
              onPress={() =>
                store.addTab(
                  "example.json",
                  typeof JsonSample === "string"
                    ? JsonSample
                    : JSON.stringify(JsonSample, null, 2),
                )
              }
            >
              {t("打开示例数据")}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      <Modal
        isOpen={!!dialog}
        onClose={() => {
          request.current?.abort();
          setDialog(null);
        }}
      >
        <ModalContent>
          <ModalHeader>
            {dialog === "rename"
              ? t("重命名文件")
              : dialog === "base64"
                ? t("从 Base64 导入")
                : dialog === "refresh"
                  ? t("刷新远程文件")
                  : t("从 URL 导入")}
          </ModalHeader>
          <ModalBody>
            {dialog === "refresh" && (
              <p className="mb-3 text-sm text-muted-foreground">
                {t("最新内容将替换当前文档，替换前的内容会保留在历史记录中。")}
              </p>
            )}
            {dialog === "base64" ? (
              <Textarea
                aria-label={t("Base64 内容")}
                value={input}
                onValueChange={setInput}
                minRows={6}
              />
            ) : (
              <Input
                aria-label={dialog === "rename" ? t("文件名称") : t("URL 地址")}
                placeholder={
                  dialog === "rename"
                    ? t("文件名称")
                    : "https://example.com/data.json"
                }
                value={input}
                onValueChange={setInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) void submit();
                }}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              onPress={() => {
                request.current?.abort();
                setDialog(null);
              }}
            >
              {t("取消")}
            </Button>
            <Button
              color="primary"
              isLoading={busy}
              isDisabled={!input.trim()}
              onPress={() => void submit()}
            >
              {dialog === "rename"
                ? t("保存")
                : dialog === "refresh"
                  ? t("刷新")
                  : t("导入")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default memo(DynamicTabs);
