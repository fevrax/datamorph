import { writeClipboardText } from "@/utils/clipboard";
import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/components/ui";
import { Button } from "@/components/ui";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useTheme } from "next-themes";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";

import toast from "@/utils/toast.tsx";
import "./assistant.css";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CopyIcon,
  ApplyIcon,
} from "@/components/Icons.tsx";

// Markdown渲染器组件接口
interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCopy?: () => void;
  // AI响应相关props
  isAi?: boolean;
  isAiLoading?: boolean;
  onStopGeneration?: () => void;
  onRegenerate?: () => void;
  onClose?: () => void;
  // 代码块应用功能
  onApplyCode?: (code: string) => void;
  // 差异编辑器相关功能
  isDiffEditor?: boolean; // 添加是否为差异编辑器的标志
  onApplyCodeToLeft?: (code: string) => void; // 应用到左侧编辑器
  onApplyCodeToRight?: (code: string) => void; // 应用到右侧编辑器
}

// 定义代码块组件，独立处理折叠逻辑
interface CodeBlockProps {
  language: string;
  content: string;
  theme: string;
  onApplyCode?: (code: string) => void;
  // 差异编辑器相关功能
  isDiffEditor?: boolean; // 添加是否为差异编辑器的标志
  onApplyCodeToLeft?: (code: string) => void; // 应用到左侧编辑器
  onApplyCodeToRight?: (code: string) => void; // 应用到右侧编辑器
}

// 定义内联代码组件，处理内联代码样式
const InlineCode: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <code className="rounded-md bg-accent px-1 py-0.5 text-foreground">
      {children}
    </code>
  );
};

const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  content,
  theme,
  onApplyCode,
  isDiffEditor,
  onApplyCodeToLeft,
  onApplyCodeToRight,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // 折叠动画处理
  const toggleCollapse = () => {
    if (!isCollapsed) {
      setIsCollapsed(true);
      setTimeout(() => setIsVisible(false), 300); // 动画结束后隐藏内容
    } else {
      setIsVisible(true);
      setIsCollapsed(false);
    }
  };

  return (
    <div className="ai-code-result">
      <div className="ai-code-toolbar">
        <div className="flex items-center space-x-2">
          <Button
            isIconOnly
            className="size-7 min-w-7 bg-transparent p-0"
            size="sm"
            title={isCollapsed ? "展开代码" : "收起代码"}
            aria-label={isCollapsed ? "展开代码" : "收起代码"}
            aria-expanded={!isCollapsed}
            variant="flat"
            onPress={toggleCollapse}
          >
            {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
          </Button>
          <span className="font-mono text-xs uppercase tracking-wide">
            {language || "text"}
          </span>
        </div>
        <div className="ai-code-actions">
          {/* 差异编辑器模式下显示两个应用按钮 */}
          {isDiffEditor ? (
            <>
              <Button
                className="ai-code-apply h-7 px-2 text-xs"
                size="sm"
                title="应用到左侧编辑器"
                variant="flat"
                onPress={() => onApplyCodeToLeft && onApplyCodeToLeft(content)}
              >
                <ApplyIcon />
                应用到左侧
              </Button>
              <Button
                className="ai-code-apply h-7 px-2 text-xs"
                size="sm"
                title="应用到右侧编辑器"
                variant="flat"
                onPress={() =>
                  onApplyCodeToRight && onApplyCodeToRight(content)
                }
              >
                <ApplyIcon />
                应用到右侧
              </Button>
            </>
          ) : (
            /* 普通模式下显示单个应用按钮 */
            onApplyCode && (
              <Button
                className="ai-code-apply h-7 px-2 text-xs"
                size="sm"
                title="应用到编辑器"
                variant="flat"
                onPress={() => onApplyCode(content)}
              >
                <ApplyIcon />
                预览修改
              </Button>
            )
          )}
          <Button
            isIconOnly
            className="size-7 min-w-7 bg-transparent p-0"
            size="sm"
            title="复制代码"
            aria-label="复制代码"
            variant="flat"
            onPress={() => {
              writeClipboardText(content);
              toast.success("已复制代码");
            }}
          >
            <CopyIcon />
          </Button>
        </div>
      </div>
      <div
        ref={contentRef}
        className={cn(
          "w-full transition-all duration-300 ease-in-out overflow-hidden text-base",
          isCollapsed ? "opacity-0 max-h-0" : "opacity-100",
        )}
        style={{ display: !isVisible && isCollapsed ? "none" : "block" }}
      >
        <SyntaxHighlighter
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: "0 0 6px 6px",
            padding: "0.875rem",
            fontSize: "12px",
            background: "var(--ai-panel, var(--background))",
            width: "100%",
          }}
          language={language || "text"}
          showLineNumbers={true}
          style={theme === "dark" ? vscDarkPlus : vs}
          wrapLines={true}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  onApplyCode,
  isDiffEditor,
  onApplyCodeToLeft,
  onApplyCodeToRight,
}) => {
  // 正确使用钩子 - 始终在组件顶层无条件调用
  const { resolvedTheme: theme } = useTheme();

  return (
    <div className={cn(className, "flex flex-col h-full w-full")}>
      <ReactMarkdown
        components={{
          // 添加 pre 组件处理
          pre({ children }) {
            // 直接返回子元素，不添加额外的 pre 标签
            return <>{children}</>;
          },
          // 添加 p 组件处理
          p({ children, ...props }) {
            // React.Children.toArray 将 children 转换为扁平数组
            const childArray = React.Children.toArray(children);

            // 检查是否包含代码块
            const hasCodeBlock = childArray.some((child) => {
              if (React.isValidElement(child) && child.type === CodeBlock) {
                return true;
              }

              return false;
            });

            // 如果包含代码块，直接返回子元素，不包装在 p 标签中
            if (hasCodeBlock) {
              return <>{children}</>;
            }

            // 否则，正常渲染 p 标签
            return <p {...props}>{children}</p>;
          },
          code({ className, children }) {
            // 检查是否是代码块（具有 language- 前缀的类名）
            const isCodeBlock = /language-(\w+)/.exec(className || "");

            if (!isCodeBlock) {
              // 内联代码
              return <InlineCode>{children}</InlineCode>;
            }

            // 代码块
            const language = isCodeBlock ? isCodeBlock[1] : "";
            const content = String(children).replace(/\n$/, "");

            // 使用提取的CodeBlock组件，并传递差异编辑器相关属性
            return (
              <CodeBlock
                content={content}
                isDiffEditor={isDiffEditor}
                language={language}
                theme={theme || "light"}
                onApplyCode={onApplyCode}
                onApplyCodeToLeft={onApplyCodeToLeft}
                onApplyCodeToRight={onApplyCodeToRight}
              />
            );
          },
          // 表格样式优化
          table({ node: _node, ...props }) {
            return (
              <div className="overflow-x-auto my-4 rounded-md border border-gray-200 dark:border-gray-700">
                <table className="min-w-full border-collapse" {...props} />
              </div>
            );
          },
          th({ node: _node, ...props }) {
            return (
              <th
                className="border-b border-gray-300 dark:border-gray-700 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-left font-medium text-gray-700 dark:text-gray-300"
                {...props}
              />
            );
          },
          td({ node: _node, ...props }) {
            return (
              <td
                className="border-b border-gray-200 dark:border-gray-800 px-4 py-2 text-sm"
                {...props}
              />
            );
          },
          // 增强引用块样式
          blockquote({ node: _node, ...props }) {
            return (
              <blockquote
                className="pl-4 border-l-4 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 py-1 my-4 rounded-r-md italic text-gray-700 dark:text-gray-300"
                {...props}
              />
            );
          },
          // 增强标题样式
          h1({ node: _node, children, ...props }) {
            return (
              <h1
                className="mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-gray-800 font-bold text-gray-900 dark:text-gray-100"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ node: _node, children, ...props }) {
            return (
              <h2
                className="mt-5 mb-3 pb-1 font-semibold text-gray-800 dark:text-gray-200"
                {...props}
              >
                {children}
              </h2>
            );
          },
          // 优化列表项样式
          ul({ node: _node, ...props }) {
            return (
              <ul
                className="pl-6 list-disc marker:text-blue-500 dark:marker:text-blue-400 my-3"
                {...props}
              />
            );
          },
          ol({ node: _node, ...props }) {
            return (
              <ol
                className="pl-6 list-decimal marker:text-blue-500 dark:marker:text-blue-400 my-3"
                {...props}
              />
            );
          },
          // 优化链接样式
          a({ node: _node, children, ...props }) {
            return (
              <a
                className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                rel="noopener noreferrer"
                target="_blank"
                {...props}
              >
                {children}
              </a>
            );
          },
          // 优化图片样式
          img({ node: _node, alt, src, ...props }) {
            return (
              <img
                alt={alt || "Markdown图片"}
                className="rounded-md max-w-full h-auto my-4 border border-gray-200 dark:border-gray-700 shadow-sm"
                src={src}
                {...props}
              />
            );
          },
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
