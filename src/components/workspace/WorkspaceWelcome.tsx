import { useRef, type ReactNode } from "react";
import {
  ArrowRight,
  FileDown,
  FileJson2,
  FlaskConical,
  FolderOpen,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui";
import { importFiles } from "@/components/dynamicTabs/DynamicTabs";
import "./workspace-welcome.css";

interface WorkspaceWelcomeProps {
  active: boolean;
  title: string;
  language: string;
  hasContent: boolean;
  busy: boolean;
  onFocus: () => void;
  onSample: () => void;
  onStart: () => void;
  onContinue: () => void;
  children: ReactNode;
}

/** Keep the live editor mounted so welcome input uses normal history and saving. */
export function WorkspaceWelcome({
  active,
  title,
  language,
  hasContent,
  busy,
  onFocus,
  onSample,
  onStart,
  onContinue,
  children,
}: WorkspaceWelcomeProps) {
  const file = useRef<HTMLInputElement>(null);
  const pasteShortcut = /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘ V"
    : "Ctrl V";

  return (
    <div
      className={active ? "workspace-welcome is-active" : "workspace-welcome"}
    >
      <input
        ref={file}
        type="file"
        multiple
        accept=".json,.json5,.txt,.yaml,.yml,.xml,.toml"
        hidden
        aria-label="选择要打开的文件"
        onChange={(event) => {
          void importFiles(Array.from(event.target.files || []));
          event.target.value = "";
        }}
      />
      <aside
        className="welcome-shortcuts"
        hidden={!active}
        aria-label="快速开始"
      >
        <span className="welcome-section-label">当前文档</span>
        <button className="welcome-document" onClick={onFocus} title={title}>
          <FileJson2 aria-hidden="true" />
          <span>{title}</span>
          <span className="welcome-document-dot" />
        </button>
        <span className="welcome-section-label">快速开始</span>
        <Button variant="ghost" onPress={() => file.current?.click()}>
          <FolderOpen aria-hidden="true" />
          打开文件
        </Button>
        <Button variant="ghost" onPress={onSample}>
          <FlaskConical aria-hidden="true" />
          载入示例
        </Button>
        <p className="welcome-sidebar-note">
          少一点点击
          <br />
          多一点专注
        </p>
      </aside>
      <div className="welcome-main">
        <div className="welcome-content">
          <header className="welcome-heading" hidden={!active}>
            <span className="welcome-eyebrow">YOUR NEXT DOCUMENT</span>
            <h2>准备好，直接开始。</h2>
            <p>在下方粘贴内容，立即整理你的 JSON。</p>
          </header>
          <div className="welcome-input">
            <div className="welcome-input-label" hidden={!active}>
              <button onClick={onFocus}>输入 {language.toUpperCase()}</button>
              <span>
                粘贴 <kbd>{pasteShortcut}</kbd>
              </span>
            </div>
            <div className="welcome-editor">{children}</div>
          </div>
          <div className="welcome-bottom" hidden={!active}>
            <div className="welcome-actions">
              <Button
                color="primary"
                isDisabled={!hasContent || busy}
                onPress={onStart}
              >
                <WandSparkles aria-hidden="true" />
                {busy ? "正在格式化…" : "格式化并开始"}
              </Button>
              <Button variant="ghost" onPress={onSample}>
                使用示例
                <ArrowRight aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                className="welcome-mobile-import"
                onPress={() => file.current?.click()}
              >
                <FolderOpen aria-hidden="true" />
                打开文件
              </Button>
            </div>
            <div className="welcome-help">
              <span>
                <FileDown aria-hidden="true" />
                也可以将文件拖入工作区
              </span>
              <button onClick={onContinue}>
                直接进入编辑器 <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
