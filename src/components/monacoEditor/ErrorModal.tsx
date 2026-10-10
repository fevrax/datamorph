import React from "react";
import {
  AlertCircle,
  Braces,
  ChevronRight,
  Crosshair,
  WandSparkles,
} from "lucide-react";
import {
  cn,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@/components/ui";
import { JsonErrorInfo } from "@/utils/json";

import "./error-modal.css";

export interface ErrorModalProps {
  parseJsonError: JsonErrorInfo | null;
  isOpen: boolean;
  onOpenChange?: () => void;
  onClose?: () => void;
  onGotoErrorLine?: () => void;
  onAutoFix?: () => void;
  ref?: React.Ref<ErrorModalRef>;
}

export interface ErrorModalRef {}

// Keep malformed JSON readable without requiring it to parse first.
function highlightLine(line: string) {
  return line
    .split(
      /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
    )
    .map((token, index) => {
      const kind = token.startsWith('"')
        ? token.endsWith(":")
          ? "key"
          : "string"
        : /^(true|false|null)$/.test(token)
          ? "literal"
          : /^-?\d/.test(token)
            ? "number"
            : undefined;
      return (
        <span
          key={index}
          className={kind ? `json-error-token-${kind}` : undefined}
        >
          {token}
        </span>
      );
    });
}

const ErrorModal: React.FC<ErrorModalProps> = ({
  parseJsonError,
  isOpen,
  onOpenChange,
  onClose,
  onGotoErrorLine,
  onAutoFix,
}) => {
  const lines = parseJsonError?.context
    ? parseJsonError.context.split("\n")
    : [];
  const line = parseJsonError?.line ?? 0;
  const column = parseJsonError?.column ?? 0;
  const hasLocation = line > 0 && column > 0;
  const startLine = parseJsonError?.contextStartLine ?? Math.max(1, line - 2);
  const detail = parseJsonError?.detail || parseJsonError?.error?.message;
  const message = parseJsonError?.message;
  const description =
    message && !/^JSON\s*解析错误$/.test(message)
      ? message
      : "在标记位置附近发现语法问题，请检查符号或尝试自动修复。";

  return (
    <Modal isOpen={isOpen} onClose={onClose} onOpenChange={onOpenChange}>
      <ModalContent className="json-error-dialog">
        {(close) => (
          <>
            <div className="json-error-heading">
              <div className="json-error-icon" aria-hidden="true">
                <AlertCircle size={22} strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <ModalHeader className="p-0 text-[17px] font-semibold tracking-tight">
                  JSON 解析失败
                </ModalHeader>
                <p className="json-error-description">{description}</p>
              </div>
            </div>
            <ModalBody className="json-error-body">
              {lines.length > 0 ? (
                <section className="json-error-preview" aria-label="错误上下文">
                  <div className="json-error-toolbar">
                    <span className="flex items-center gap-2">
                      <Braces size={14} aria-hidden="true" />
                      代码上下文
                    </span>
                    <span className="json-error-location">
                      {hasLocation
                        ? `第 ${line} 行 · 第 ${column} 列`
                        : "位置未知"}
                    </span>
                  </div>
                  {/* A scrollable region needs a tab stop for keyboard scrolling. */}
                  <div
                    className="json-error-code-scroll"
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    tabIndex={0}
                    role="region"
                    aria-label="JSON 代码预览，可横向滚动"
                  >
                    <div className="json-error-code">
                      {lines.map((text, index) => {
                        const isError = startLine + index === line;
                        const offset = Math.min(
                          Math.max(0, column - 1),
                          text.length,
                        );
                        return (
                          <div
                            key={index}
                            className={cn(
                              "json-error-row",
                              isError && "is-error",
                            )}
                            aria-label={
                              isError
                                ? `错误位置：第 ${line} 行，第 ${column} 列`
                                : undefined
                            }
                          >
                            <span
                              className="json-error-line-number"
                              aria-hidden="true"
                            >
                              {startLine + index}
                            </span>
                            <div className="json-error-source">
                              <code>{highlightLine(text || " ")}</code>
                              {isError && column > 0 && (
                                <div
                                  className="json-error-pointer"
                                  aria-hidden="true"
                                >
                                  <span className="json-error-pointer-indent">
                                    {text.slice(0, offset)}
                                  </span>
                                  <span className="json-error-caret">^</span>
                                  <span className="json-error-pointer-label">
                                    检查此处
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ) : (
                <div className="json-error-empty">
                  暂时无法显示代码上下文，可返回编辑器检查内容或尝试自动修复。
                </div>
              )}
              {detail && (
                <details className="json-error-details">
                  <summary>
                    <ChevronRight size={14} aria-hidden="true" />
                    解析器详情
                  </summary>
                  <p>{detail}</p>
                </details>
              )}
            </ModalBody>
            <ModalFooter className="json-error-footer">
              <Button
                className="json-error-dismiss"
                variant="ghost"
                onPress={close}
              >
                返回编辑
              </Button>
              <div className="json-error-actions">
                <Button
                  isDisabled={!hasLocation || !onGotoErrorLine}
                  onPress={() => {
                    close();
                    requestAnimationFrame(() => onGotoErrorLine?.());
                  }}
                >
                  <Crosshair size={15} aria-hidden="true" />
                  定位错误
                </Button>
                <Button
                  color="primary"
                  isDisabled={!onAutoFix}
                  onPress={() => {
                    close();
                    onAutoFix?.();
                  }}
                >
                  <WandSparkles size={15} aria-hidden="true" />
                  自动修复
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ErrorModal;
