import { t } from "@/i18n";
import { useLocale } from "@/i18n/useLocale";
import { useContext, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Binary, FolderOpen, Link, Sparkles } from "lucide-react";
import { importFiles } from "@/components/dynamicTabs/DynamicTabs";
import { WorkspaceActionsContext } from "@/components/workspace/WorkspaceActions";
import type { DocumentView } from "@/store/useTabStore";
import { DATA_FILE_ACCEPT } from "@/utils/dataFormats";
import { JsonSample } from "@/utils/jsonSample";
import { ProtoSample, YamlSample } from "@/utils/welcomeSamples";
import "./workspace-welcome.css";

type MorphPreviewMode = "json" | "yaml" | "proto" | "table";

export interface WorkspaceWelcomeSampleOptions {
  view?: DocumentView;
}

export interface WorkspaceWelcomeProps {
  onSample: (content: string, options?: WorkspaceWelcomeSampleOptions) => void;
  onOpenAI?: () => void;
  onImportUrl?: () => void;
  onImportBase64?: () => void;
}

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(
    navigator.platform || navigator.userAgent,
  );
}

function CodeLine({
  lineNumber,
  children,
}: {
  lineNumber: number;
  children: ReactNode;
}) {
  return (
    <div className="workspace-welcome-code-line">
      <span className="workspace-welcome-ln" aria-hidden="true">
        {lineNumber}
      </span>
      <span className="workspace-welcome-code-text">{children}</span>
    </div>
  );
}

function MorphPreviewContent({ mode }: { mode: MorphPreviewMode }) {
  if (mode === "table") {
    return (
      <div className="workspace-welcome-table">
        <div className="workspace-welcome-table-row workspace-welcome-table-head">
          <span>{t("字段")}</span>
          <span className="workspace-welcome-table-type">{t("类型")}</span>
          <span>{t("原始值")}</span>
          <span>{t("智能解析")}</span>
        </div>
        <div className="workspace-welcome-table-row workspace-welcome-table-body">
          <span className="truncate welcome-syn-key">token</span>
          <span className="workspace-welcome-table-type text-muted-foreground">
            string
          </span>
          <span className="truncate welcome-syn-string">
            &quot;RGF0YW1vcnBo&quot;
          </span>
          <span className="truncate text-success">Datamorph (Base64)</span>
        </div>
        <div className="workspace-welcome-table-row workspace-welcome-table-body">
          <span className="truncate welcome-syn-key">createdAt</span>
          <span className="workspace-welcome-table-type text-muted-foreground">
            number
          </span>
          <span className="truncate welcome-syn-number">1750563586000</span>
          <span className="truncate text-[var(--welcome-hint-time)]">
            2025-06-22 11:39
          </span>
        </div>
        <div className="workspace-welcome-table-row workspace-welcome-table-body">
          <span className="truncate welcome-syn-key">accent</span>
          <span className="workspace-welcome-table-type text-muted-foreground">
            string
          </span>
          <span className="truncate welcome-syn-string">
            &quot;#4f5fd5&quot;
          </span>
          <span className="inline-flex min-w-0 items-center truncate text-foreground">
            <span className="welcome-swatch shrink-0" aria-hidden="true" />
            <span className="truncate">{t("靛蓝")}</span>
          </span>
        </div>
      </div>
    );
  }

  if (mode === "yaml") {
    return (
      <div className="workspace-welcome-code">
        <CodeLine lineNumber={1}>
          <span className="welcome-syn-key">service</span>
          <span className="welcome-syn-punct">: </span>
          <span className="welcome-syn-string">datamorph</span>
        </CodeLine>
        <CodeLine lineNumber={2}>
          <span className="welcome-syn-key">views</span>
          <span className="welcome-syn-punct">:</span>
        </CodeLine>
        <CodeLine lineNumber={3}>
          <span className="welcome-syn-punct">{"  - "}</span>
          <span className="welcome-syn-string">code</span>
          <span className="welcome-syn-comment">
            {"  # "}
            {t("Monaco 智能编辑")}
          </span>
        </CodeLine>
        <CodeLine lineNumber={4}>
          <span className="welcome-syn-punct">{"  - "}</span>
          <span className="welcome-syn-string">tree</span>
          <span className="welcome-syn-comment">
            {"  # "}
            {t("树形结构浏览")}
          </span>
        </CodeLine>
        <CodeLine lineNumber={5}>
          <span className="welcome-syn-punct">{"  - "}</span>
          <span className="welcome-syn-string">table</span>
          <span className="welcome-syn-comment">
            {" # "}
            {t("表格与筛选导出")}
          </span>
        </CodeLine>
        <CodeLine lineNumber={6}>
          <span className="welcome-syn-key">autoDetect</span>
          <span className="welcome-syn-punct">: </span>
          <span className="welcome-syn-keyword">true</span>
        </CodeLine>
      </div>
    );
  }

  if (mode === "proto") {
    return (
      <div className="workspace-welcome-code">
        <CodeLine lineNumber={1}>
          <span className="welcome-syn-keyword">syntax</span>
          <span className="welcome-syn-punct"> = </span>
          <span className="welcome-syn-string">&quot;proto3&quot;</span>
          <span className="welcome-syn-punct">;</span>
        </CodeLine>
        <CodeLine lineNumber={2}>
          <span className="welcome-syn-keyword">message</span>{" "}
          <span className="welcome-syn-key">DocumentEvent</span>
          <span className="welcome-syn-punct">{" {"}</span>
        </CodeLine>
        <CodeLine lineNumber={3}>
          {"  "}
          <span className="welcome-syn-keyword">int64</span> id
          <span className="welcome-syn-punct"> = </span>
          <span className="welcome-syn-number">1</span>
          <span className="welcome-syn-punct">;</span>
        </CodeLine>
        <CodeLine lineNumber={4}>
          {"  "}
          <span className="welcome-syn-keyword">string</span> format
          <span className="welcome-syn-punct"> = </span>
          <span className="welcome-syn-number">2</span>
          <span className="welcome-syn-punct">;</span>
          <span className="welcome-syn-comment">
            {" // "}
            {t("支持一键重排编号")}
          </span>
        </CodeLine>
        <CodeLine lineNumber={5}>
          {"  "}
          <span className="welcome-syn-keyword">repeated string</span> tags
          <span className="welcome-syn-punct"> = </span>
          <span className="welcome-syn-number">3</span>
          <span className="welcome-syn-punct">;</span>
        </CodeLine>
        <CodeLine lineNumber={6}>
          <span className="welcome-syn-punct">{"}"}</span>
        </CodeLine>
      </div>
    );
  }

  return (
    <div className="workspace-welcome-code">
      <CodeLine lineNumber={1}>
        <span className="welcome-syn-punct">{"{"}</span>
      </CodeLine>
      <CodeLine lineNumber={2}>
        {"  "}
        <span className="welcome-syn-key">&quot;service&quot;</span>
        <span className="welcome-syn-punct">: </span>
        <span className="welcome-syn-string">&quot;datamorph&quot;</span>
        <span className="welcome-syn-punct">,</span>
      </CodeLine>
      <CodeLine lineNumber={3}>
        {"  "}
        <span className="welcome-syn-key">&quot;token&quot;</span>
        <span className="welcome-syn-punct">: </span>
        <span className="welcome-syn-string welcome-syn-decoded">
          &quot;RGF0YW1vcnBo&quot;
        </span>
        <span className="welcome-syn-punct">,</span>
        <span className="welcome-decode-pill welcome-decode-pill-success">
          Base64 → Datamorph
        </span>
      </CodeLine>
      <CodeLine lineNumber={4}>
        {"  "}
        <span className="welcome-syn-key">&quot;createdAt&quot;</span>
        <span className="welcome-syn-punct">: </span>
        <span className="welcome-syn-number">1750563586000</span>
        <span className="welcome-syn-punct">,</span>
        <span className="welcome-decode-pill welcome-decode-pill-time">
          2025-06-22 11:39
        </span>
      </CodeLine>
      <CodeLine lineNumber={5}>
        {"  "}
        <span className="welcome-syn-key">&quot;accent&quot;</span>
        <span className="welcome-syn-punct">: </span>
        <span className="welcome-swatch" aria-hidden="true" />
        <span className="welcome-syn-string">&quot;#4f5fd5&quot;</span>
      </CodeLine>
      <CodeLine lineNumber={6}>
        <span className="welcome-syn-punct">{"}"}</span>
      </CodeLine>
    </div>
  );
}

export function WorkspaceWelcome({
  onSample,
  onOpenAI,
  onImportUrl,
  onImportBase64,
}: WorkspaceWelcomeProps) {
  useLocale();
  const file = useRef<HTMLInputElement>(null);
  const actions = useContext(WorkspaceActionsContext);
  const [mode, setMode] = useState<MorphPreviewMode>("json");
  const modKey = isApplePlatform() ? "⌘" : "Ctrl";

  const previewModes: readonly { id: MorphPreviewMode; label: string }[] = [
    { id: "json", label: "JSON" },
    { id: "yaml", label: "YAML" },
    { id: "proto", label: "Protobuf" },
    { id: "table", label: t("表格视图") },
  ];

  function handleLoadSample() {
    if (mode === "yaml") {
      onSample(YamlSample);
    } else if (mode === "proto") {
      onSample(ProtoSample);
    } else if (mode === "table") {
      onSample(JsonSample, { view: "table" });
    } else {
      onSample(JsonSample);
    }
  }

  return (
    <section
      aria-label={t("开始编辑文档")}
      className="workspace-welcome pointer-events-none absolute inset-0 z-10 flex flex-col items-center overflow-y-auto px-4 py-6"
    >
      <div className="workspace-welcome-backdrop" aria-hidden="true" />
      <div className="workspace-welcome-dots" aria-hidden="true" />

      <div className="workspace-welcome-inner relative z-10 my-auto flex w-full max-w-[560px] flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <span className="workspace-welcome-emblem" aria-hidden="true">
            <img src="./logo.png" alt="" width={17} height={17} />
          </span>
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
            {t("粘贴或输入数据")}
          </h2>
        </div>

        <p className="mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted-foreground">
          {t("自动识别 19+ 数据格式，支持行内智能解码与多视图切换。")}
        </p>

        <div className="workspace-welcome-card pointer-events-auto mt-5">
          <div className="workspace-welcome-card-bar">
            <div
              role="group"
              aria-label={t("预览数据形态")}
              className="workspace-welcome-tabs"
            >
              {previewModes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={mode === item.id}
                  onClick={() => setMode(item.id)}
                  className="workspace-welcome-tab"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleLoadSample}
              className="workspace-welcome-load"
            >
              <span>{t("载入示例")}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>

          <div className="workspace-welcome-preview">
            <MorphPreviewContent mode={mode} />
          </div>
        </div>

        <div className="pointer-events-auto mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="workspace-welcome-pill workspace-welcome-pill-primary"
          >
            <FolderOpen aria-hidden="true" />
            {t("打开文件")}
          </button>
          {onImportUrl && (
            <button
              type="button"
              onClick={onImportUrl}
              className="workspace-welcome-pill"
            >
              <Link aria-hidden="true" />
              {t("URL 导入")}
            </button>
          )}
          {onImportBase64 && (
            <button
              type="button"
              onClick={onImportBase64}
              className="workspace-welcome-pill"
            >
              <Binary aria-hidden="true" />
              Base64
            </button>
          )}
          {onOpenAI && (
            <button
              type="button"
              onClick={onOpenAI}
              className="workspace-welcome-pill"
            >
              <Sparkles className="text-primary" aria-hidden="true" />
              {t("AI 生成")}
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="workspace-welcome-kbd">{modKey} V</kbd>
            {t("直接粘贴")}
          </span>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          {actions ? (
            <button
              type="button"
              onClick={actions.openSearch}
              className="workspace-welcome-footer-action pointer-events-auto"
            >
              <kbd className="workspace-welcome-kbd">{modKey} K</kbd>
              {t("命令面板")}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <kbd className="workspace-welcome-kbd">{modKey} K</kbd>
              {t("命令面板")}
            </span>
          )}
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span>{t("拖放文件至此")}</span>
        </div>
      </div>

      <input
        ref={file}
        type="file"
        multiple
        accept={DATA_FILE_ACCEPT}
        hidden
        onChange={(event) => {
          void importFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
