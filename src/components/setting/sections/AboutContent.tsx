import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

import { GroupLabel, SectionCard, SectionHeader } from "../settingPrimitives";

import ExternalLink from "@/components/ExternalLink";
import { APP_BUILD_INFO } from "@/utils/appBuildInfo";
import {
  compareReleaseVersions,
  RELEASES_URL,
  REPOSITORY_URL,
  releaseUrl,
} from "@/utils/appVersion";
import {
  releaseChecker,
  type LatestReleaseInfo,
} from "@/services/releaseChecker";

const APP_VERSION = APP_BUILD_INFO.version
  ? `v${APP_BUILD_INFO.version}`
  : "开发构建";
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

type CheckState =
  | { status: "idle" | "checking" }
  | { status: "success"; release: LatestReleaseInfo }
  | { status: "error"; message: string };

const FEATURES = [
  { label: "多格式识别与语法高亮", icon: "solar:check-circle-bold" },
  { label: "智能 AI 辅助修复", icon: "solar:check-circle-bold" },
  { label: "数据格式转换", icon: "solar:check-circle-bold" },
];

const LINKS = [
  {
    href: REPOSITORY_URL,
    icon: "mdi:github",
    label: "GitHub 仓库",
  },
  {
    href: `${REPOSITORY_URL}/issues`,
    icon: "solar:chat-square-code-bold",
    label: "问题反馈",
  },
  {
    href: REPOSITORY_URL,
    icon: "solar:document-bold",
    label: "使用文档",
  },
];

/**
 * 关于页（Apple 系统风 · 居中 Hero + 双列）。
 * 放宽宽度限制：根容器 max-w-5xl，内容用 grid 充分利用横向空间。
 */
export function AboutContent() {
  const [checkState, setCheckState] = useState<CheckState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const checkForUpdates = async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();

    activeRequest.current = controller;
    setCheckState({ status: "checking" });
    try {
      const release = await releaseChecker.check(controller.signal);

      if (!controller.signal.aborted)
        setCheckState({ status: "success", release });
    } catch (error) {
      if (!controller.signal.aborted) {
        setCheckState({
          status: "error",
          message:
            error instanceof Error ? error.message : "检查更新失败，请重试",
        });
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  };
  const latest = checkState.status === "success" ? checkState.release : null;
  const comparison = latest
    ? compareReleaseVersions(APP_BUILD_INFO.version, latest.version)
    : null;
  const resultTitle = latest
    ? {
        development: `GitHub 最新正式版 v${latest.version}`,
        newer: `发现新版本 v${latest.version}`,
        current: "已是最新正式版",
        ahead: "当前版本高于最新正式版",
      }[comparison!]
    : null;

  return (
    <div className="h-full">
      <SectionHeader
        description="了解更多关于应用的信息"
        title="关于 Datamorph"
      />

      {/* 品牌信息 */}
      <SectionCard className="mb-5">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
              <img alt="Datamorph Logo" className="h-8 w-8" src="./logo.png" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                Datamorph
              </h3>
              <p className="text-[12px] text-muted-foreground">
                一源万构，形随需变。面向开发者的数据处理工作台。
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {APP_VERSION}
          </span>
        </div>
      </SectionCard>

      <GroupLabel>版本信息</GroupLabel>
      <SectionCard>
        <dl className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">当前版本</dt>
            <dd className="mt-1 text-[13px] font-medium">
              {APP_BUILD_INFO.version ? (
                <ExternalLink
                  showUrl
                  className="text-primary hover:underline"
                  href={releaseUrl(APP_BUILD_INFO.version)}
                >
                  {APP_VERSION}
                </ExternalLink>
              ) : (
                APP_VERSION
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">提交</dt>
            <dd className="mt-1 text-[13px] font-medium">
              {APP_BUILD_INFO.commitSha ? (
                <ExternalLink
                  showUrl
                  className="font-mono text-primary hover:underline"
                  href={`${REPOSITORY_URL}/commit/${APP_BUILD_INFO.commitSha}`}
                  title={APP_BUILD_INFO.commitSha}
                >
                  {APP_BUILD_INFO.commitSha.slice(0, 7)}
                </ExternalLink>
              ) : (
                "未知"
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">构建时间</dt>
            <dd className="mt-1 text-[13px] font-medium">
              {APP_BUILD_INFO.builtAt ? (
                <time dateTime={APP_BUILD_INFO.builtAt}>
                  {dateFormat.format(new Date(APP_BUILD_INFO.builtAt))}
                </time>
              ) : (
                "开发服务器未记录"
              )}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-3 border-t border-border/60 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div aria-live="polite" role="status">
              <p className="text-[13px] font-medium">
                {checkState.status === "error"
                  ? checkState.message
                  : checkState.status === "checking"
                    ? "正在检查 GitHub 最新正式发布…"
                    : (resultTitle ?? "手动检查 GitHub 最新正式发布")}
              </p>
              {latest ? (
                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                  <p>
                    {comparison === "development"
                      ? "当前为开发构建，无法与正式版本比较。"
                      : `GitHub 最新正式版 v${latest.version}`}
                  </p>
                  <p>
                    上次检查：
                    <time dateTime={new Date(latest.checkedAt).toISOString()}>
                      {dateFormat.format(latest.checkedAt)}
                    </time>
                  </p>
                </div>
              ) : null}
            </div>
            <ExternalLink
              showUrl
              className="mt-2 inline-flex text-xs text-primary hover:underline"
              href={latest ? releaseUrl(latest.version) : RELEASES_URL}
            >
              {latest ? "查看更新日志" : "查看全部发布"}
            </ExternalLink>
          </div>
          <Button
            className="w-fit"
            isLoading={checkState.status === "checking"}
            size="sm"
            onPress={() => void checkForUpdates()}
          >
            {checkState.status === "checking"
              ? "检查中…"
              : checkState.status === "error"
                ? "重新检查"
                : "检查更新"}
          </Button>
        </div>
      </SectionCard>

      {/* 双列：功能特点 + 技术支持 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <GroupLabel>功能特点</GroupLabel>
          <SectionCard divided>
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 px-3 py-3 sm:px-4"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-success text-white">
                  <Icon icon={f.icon} width={18} />
                </div>
                <span className="text-[13px] font-medium text-foreground">
                  {f.label}
                </span>
              </div>
            ))}
          </SectionCard>
        </div>

        <div>
          <GroupLabel>技术支持</GroupLabel>
          <SectionCard divided>
            {LINKS.map((l) => (
              <ExternalLink
                key={l.label}
                showUrl
                className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/80 sm:px-4"
                href={l.href}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Icon icon={l.icon} width={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-foreground">
                    {l.label}
                  </span>
                </div>
                <Icon
                  className="flex-shrink-0 text-muted-foreground"
                  icon="solar:arrow-right-linear"
                  width={16}
                />
              </ExternalLink>
            ))}
          </SectionCard>
        </div>
      </div>

      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        © {new Date().getFullYear()} Datamorph · 基于 React、TypeScript 和
        shadcn/ui 构建
      </p>
    </div>
  );
}
