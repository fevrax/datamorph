import { useTabMetadata } from "@/store/useTabMetadata";
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
export interface DynamicTabsRef {
  getPositionTop: () => number;
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
      toast.error("无法读取文件", String(error));
    }
  }
}
function DynamicTabs({
  ref,
  onSwitch,
  onClose,
  onUrlRefresh,
}: DynamicTabsProps) {
  const tabs = useTabMetadata();
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
    setInput(
      type === "rename"
        ? store.getTabByKey(key)?.title || ""
        : type === "refresh"
          ? String(store.getTabByKey(key)?.extraData?.url || "")
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
        if (!result.success) throw new Error(result.error || "Base64 无效");
        store.addTab("decoded.json", result.decoded);
        setDialog(null);
        return;
      }
      setBusy(true);
      const url = new URL(input);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("请输入 HTTP 或 HTTPS 地址");
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
          store.addTab(before.title + " · 最新数据", text, { url: input });
          toast.warning("原文件已变化，已在新标签打开最新数据");
        }
      } else
        store.addTab(url.pathname.split("/").pop() || "remote.json", text, {
          url: input,
        });
      setDialog(null);
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        toast.error("操作失败", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      ref={root}
      className="flex min-h-10 shrink-0 items-center border-b bg-muted/50"
    >
      <input
        ref={file}
        type="file"
        multiple
        accept=".json,.json5,.txt,.yaml,.yml,.xml,.toml"
        className="hidden"
        onChange={(e) => {
          void importFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <div
        role="tablist"
        aria-label="工作区标签"
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
                  {tab.kind === "json" ? (
                    <Braces className="size-3.5 shrink-0 text-primary" />
                  ) : (
                    <Blocks className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{tab.title}</span>
                </button>
                {Boolean(tab.extraData?.url) && (
                  <button
                    aria-label={`刷新 ${tab.title}`}
                    onClick={() => open("refresh", tab.key)}
                    className="rounded p-0.5 hover:bg-accent"
                  >
                    <RefreshCw className="size-3" />
                  </button>
                )}
                <button
                  aria-label={`关闭 ${tab.title}`}
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
                  ["重命名", () => open("rename", tab.key)],
                  [
                    "关闭",
                    () => {
                      store.closeTab(tab.key);
                      onClose?.([tab.key]);
                    },
                  ],
                  [
                    "关闭其他标签",
                    () => {
                      const closed = store.closeOtherTabs(tab.key);
                      onClose?.(closed);
                    },
                  ],
                  [
                    "关闭左侧标签",
                    () => {
                      const closed = store.closeLeftTabs(tab.key);
                      onClose?.(closed);
                    },
                  ],
                  [
                    "关闭右侧标签",
                    () => {
                      const closed = store.closeRightTabs(tab.key);
                      onClose?.(closed);
                    },
                  ],
                  [
                    "关闭全部标签",
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
      <Button
        isIconOnly
        variant="ghost"
        aria-label="新建 JSON"
        className="mx-1"
        onPress={() => store.addTab()}
      >
        <Plus />
      </Button>
      <Dropdown>
        <DropdownTrigger>
          <Button isIconOnly variant="ghost" aria-label="导入与新建">
            <ChevronDown />
          </Button>
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownItem
            startContent={<FilePlus className="size-4" />}
            onPress={() => store.addTab()}
          >
            空白文档
          </DropdownItem>
          <DropdownItem
            startContent={<Upload className="size-4" />}
            onPress={() => file.current?.click()}
          >
            导入文件
          </DropdownItem>
          <DropdownItem
            startContent={<Link className="size-4" />}
            onPress={() => open("url")}
          >
            从 URL 导入
          </DropdownItem>
          <DropdownItem
            startContent={<Binary className="size-4" />}
            onPress={() => open("base64")}
          >
            从 Base64 导入
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
            打开示例数据
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
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
              ? "重命名文件"
              : dialog === "base64"
                ? "从 Base64 导入"
                : dialog === "refresh"
                  ? "刷新远程文件"
                  : "从 URL 导入"}
          </ModalHeader>
          <ModalBody>
            {dialog === "refresh" && (
              <p className="mb-3 text-sm text-muted-foreground">
                最新内容将替换当前文档，替换前的内容会保留在历史记录中。
              </p>
            )}
            {dialog === "base64" ? (
              <Textarea
                aria-label="Base64 内容"
                value={input}
                onValueChange={setInput}
                minRows={6}
              />
            ) : (
              <Input
                aria-label={dialog === "rename" ? "文件名称" : "URL 地址"}
                placeholder={
                  dialog === "rename"
                    ? "文件名称"
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
              取消
            </Button>
            <Button
              color="primary"
              isLoading={busy}
              isDisabled={!input.trim()}
              onPress={() => void submit()}
            >
              {dialog === "rename"
                ? "保存"
                : dialog === "refresh"
                  ? "刷新"
                  : "导入"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default memo(DynamicTabs);
