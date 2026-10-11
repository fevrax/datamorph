import { useRef, type ReactNode } from "react";
import {
  ArrowRight,
  FileDown,
  FileText,
  FlaskConical,
  FolderOpen,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui";
import { importFiles } from "@/components/dynamicTabs/DynamicTabs";
import "./workspace-welcome.css";
import { DATA_FILE_ACCEPT } from "@/utils/dataFormats";

interface WorkspaceWelcomeProps {
  active: boolean;
  title: string;
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
        accept={DATA_FILE_ACCEPT}
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
          <FileText aria-hidden="true" />
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
            <h2>一源万构，形随需变</h2>
            <p>
              粘贴、输入或打开数据，Datamorph 自动识别格式，随需编辑与转换。
            </p>
          </header>
          <div className="welcome-input">
            <div className="welcome-input-label" hidden={!active}>
              <button onClick={onFocus}>粘贴或输入数据</button>
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
                {busy ? "正在准备…" : "开始编辑"}
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
