import React from "react";
import { cn } from "@/components/ui";

import { isUtoolsAvailable, openExternal } from "@/utils/env";

export interface ExternalLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /**
   * 是否在 uTools 环境下额外展示完整 URL 文本，作为可复制的兜底。
   * 浏览器环境不会显示。
   */
  showUrl?: boolean;
}

/**
 * 统一的外部链接组件。
 *
 * 背景：uTools（Electron）会拦截 target="_blank" 的新窗口导航，导致普通 <a> 无法打开。
 * - uTools 环境：点击时调用 utools.shellOpenExternal 在系统默认浏览器打开；
 *   可通过 showUrl 同时展示完整 URL 文本供用户手动复制。
 * - 浏览器环境：保持原生 <a target="_blank" rel="noopener noreferrer"> 行为不变。
 */
const ExternalLink: React.FC<ExternalLinkProps> = ({
  href = "",
  showUrl = false,
  className,
  children,
  onClick,
  ...rest
}) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;

    // 浏览器环境：交给原生 <a target="_blank"> 处理
    if (!isUtoolsAvailable) return;

    // uTools 环境：阻止默认导航，改用官方 API 打开
    e.preventDefault();
    if (href) openExternal(href);
  };

  return (
    <>
      <a
        {...rest}
        className={className}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
        onClick={handleClick}
      >
        {children}
      </a>
      {showUrl && isUtoolsAvailable && href ? (
        <span
          className={cn(
            "block mt-0.5 text-xs text-muted-foreground break-all select-all",
          )}
        >
          {href}
        </span>
      ) : null}
    </>
  );
};

export default ExternalLink;
