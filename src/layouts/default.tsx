import { useTabMetadata } from "@/store/useTabMetadata";
import "@/styles/globals.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Braces,
  Blocks,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Search,
  Plus,
  FileJson2,
  X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { Command } from "cmdk";
import { Tooltip } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useTabStore } from "@/store/useTabStore";
import { useToolboxStore } from "@/store/useToolboxStore";
import { ThemeSwitch } from "@/components/button/ThemeSwitch";
export default function DefaultLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const expand = useSettingsStore((s) => s.expandSidebar);
  const setExpand = useSettingsStore((s) => s.setExpandSidebar);
  const tabs = useTabMetadata();
  const activeKey = useTabStore((s) => s.activeTabKey);
  const current = tabs.find((t) => t.key === activeKey);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1024);
  const [mobile, setMobile] = useState(false);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const [commands, setCommands] = useState(false);
  const collapsed = !expand || narrow;
  const section =
    pathname === "/settings"
      ? "settings"
      : pathname.startsWith("/toolbox") || current?.kind !== "document"
        ? "tools"
        : "editor";
  useEffect(() => {
    void useSettingsStore.getState().syncSettingsStore().catch(console.error);
    const resize = () => setNarrow(window.innerWidth < 1024);
    window.addEventListener("resize", resize);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommands((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", key);
    };
  }, []);
  function go(id: string) {
    setMobile(false);
    if (id === "settings") navigate("/settings");
    else if (id === "tools") {
      useTabStore.getState().openToolboxTab();
      navigate("/toolbox");
    } else {
      const tab = [...tabs].reverse().find((t) => t.kind === "document");
      if (tab) useTabStore.getState().setActiveTab(tab.key);
      else useTabStore.getState().addTab(undefined, undefined);
      navigate("/");
    }
  }
  function run(action: () => void) {
    setCommands(false);
    action();
  }
  const nav = (compact: boolean, drawer = false) => (
    <>
      <div className="nav-brand-row">
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">
            <img src="./logo.png" alt="" width={28} height={28} />
          </span>
          {!compact && (
            <span className="brand-label">
              Datamorph<small>数据处理工作台</small>
            </span>
          )}
        </div>
        {drawer && (
          <button
            className="nav-icon-button"
            aria-label="关闭导航"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        )}
      </div>
      <nav className="nav-workspace" aria-label="工作空间">
        {!compact && <div className="nav-section">工作空间</div>}
        {(
          [
            { id: "editor", label: "编辑器", Icon: Braces },
            { id: "tools", label: "工具箱", Icon: Blocks },
          ] as const
        ).map(({ id, label, Icon }) => (
          <Tooltip
            key={id}
            content={label}
            placement="right"
            isDisabled={!compact}
          >
            <button
              className={`nav-link ${section === id ? "active" : ""}`}
              aria-label={label}
              aria-current={section === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <span className="nav-icon">
                <Icon />
              </span>
              {!compact && (
                <>
                  <span className="nav-label">{label}</span>
                  <span className="nav-active-dot" aria-hidden="true" />
                </>
              )}
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="nav-bottom">
        <Tooltip content="设置" placement="right" isDisabled={!compact}>
          <button
            className={`nav-link ${section === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
            aria-label="设置"
            aria-current={section === "settings" ? "page" : undefined}
          >
            <span className="nav-icon">
              <Settings2 />
            </span>
            {!compact && <span className="nav-label">设置</span>}
          </button>
        </Tooltip>
        <div className="nav-utilities">
          <ThemeSwitch isCollapsed={compact} className="nav-theme" />
          {!drawer && (
            <Tooltip
              content={compact ? "展开侧栏" : "折叠侧栏"}
              placement="right"
            >
              <button
                className="nav-icon-button nav-collapse"
                aria-label={compact ? "展开侧栏" : "折叠侧栏"}
                aria-expanded={!compact}
                onClick={() => {
                  setExpand(compact);
                  setNarrow(false);
                }}
              >
                {compact ? <PanelLeftOpen /> : <PanelLeftClose />}
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </>
  );
  return (
    <div className="workbench">
      <aside className={`workbench-nav ${collapsed ? "collapsed" : ""}`}>
        {nav(collapsed)}
      </aside>
      <div className="workspace-frame">
        <header className="workspace-header">
          <div className="flex items-center gap-2">
            <button
              ref={mobileTrigger}
              className="mobile-nav-toggle nav-icon-button"
              aria-label="打开导航"
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <h1>
              {section === "settings"
                ? "偏好设置"
                : section === "tools"
                  ? "开发工具"
                  : "工作台"}
              <span className="ml-3 text-muted-foreground/70">/</span>
              <span className="ml-3 font-normal text-muted-foreground">
                {section === "settings"
                  ? "让工具适合你的习惯"
                  : current?.title || "文档"}
              </span>
            </h1>
          </div>
          <button className="command-trigger" onClick={() => setCommands(true)}>
            <Search className="size-3.5" />
            <span>搜索标签与操作</span>
            <kbd>⌘ K</kbd>
          </button>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
      <Dialog.Root open={mobile} onOpenChange={setMobile}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            id="workspace-navigation"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              mobileTrigger.current?.focus();
            }}
            aria-describedby={undefined}
            className="workbench-nav nav-drawer fixed inset-y-0 left-0 z-50"
          >
            <Dialog.Title className="sr-only">导航</Dialog.Title>
            {nav(false, true)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Command.Dialog
        open={commands}
        onOpenChange={setCommands}
        label="搜索标签与操作"
        contentClassName="command-dialog"
      >
        <Command.Input placeholder="搜索标签、工具或操作…" />
        <Command.List>
          <Command.Empty>没有匹配的结果</Command.Empty>
          <Command.Group heading="操作">
            <Command.Item
              onSelect={() =>
                run(() => {
                  useTabStore.getState().addTab(undefined, undefined);
                  navigate("/");
                })
              }
            >
              <Plus />
              新建文档
            </Command.Item>
            <Command.Item onSelect={() => run(() => go("tools"))}>
              <Blocks />
              打开工具箱
            </Command.Item>
            <Command.Item onSelect={() => run(() => go("settings"))}>
              <Settings2 />
              设置
            </Command.Item>
          </Command.Group>
          <Command.Group heading="已打开的标签">
            {tabs.map((tab) => (
              <Command.Item
                key={tab.key}
                value={`${tab.title} ${tab.key}`}
                onSelect={() =>
                  run(() => {
                    useTabStore.getState().setActiveTab(tab.key);
                    navigate("/");
                  })
                }
              >
                <FileJson2 />
                {tab.title}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="工具">
            {useToolboxStore.getState().tools.map((tool) => (
              <Command.Item
                key={tool.id}
                onSelect={() =>
                  run(() => {
                    useTabStore.getState().addToolTab(tool);
                    navigate("/");
                  })
                }
              >
                <Blocks />
                {tool.name}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </div>
  );
}
