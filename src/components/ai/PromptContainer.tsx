import { writeClipboardText } from "@/utils/clipboard";
import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/components/ui";

import MarkdownRenderer from "@/components/ai/MarkdownRenderer.tsx";
import { CopyIcon, MenuDotsIcon } from "@/components/Icons.tsx";
import { OpenAIService } from "@/services/openAIService";
import {
  AIRequestSlot,
  createAIRequestId,
} from "@/services/aiRequestLifecycle";
import toast from "@/utils/toast";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useOpenAIConfigStore } from "@/store/useOpenAIConfigStore";
import AIModelPicker from "./AIModelPicker";
import {
  ArrowUp,
  Orbit,
  Square,
  WandSparkles,
  ScanText,
  CaseSensitive,
  Sparkles,
} from "lucide-react";
import "./assistant.css";

interface MessageCardProps {
  message?: React.ReactNode;
  isLoading?: boolean;
  isUser?: boolean;
  timestamp?: number;
  documentStyle?: boolean;
  onCopyMessage?: () => void;
  onDeleteMessage?: () => void;
  onRegenerateMessage?: () => void;
}

const MessageCard: React.FC<MessageCardProps> = ({
  message,
  isLoading = false,
  isUser = false,
  timestamp,
  documentStyle = false,
  onCopyMessage,
  onDeleteMessage,
  onRegenerateMessage,
}) => (
  <article
    className={cn(
      "ai-message",
      isUser ? "ai-message-user" : "ai-message-assistant",
      documentStyle && "ai-message-document",
    )}
  >
    {!isUser && (
      <div className="ai-message-label">
        <Sparkles className="size-3.5" />
        AI 助手
      </div>
    )}
    <div className={cn("min-w-0 break-words", isUser && "whitespace-pre-wrap")}>
      {message}
    </div>
    <div className="ai-message-actions">
      {timestamp && (
        <time dateTime={new Date(timestamp).toISOString()}>
          {new Date(timestamp).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </time>
      )}
      {!isLoading && (
        <>
          <Button
            isIconOnly
            className="size-7 min-w-7 p-0"
            size="sm"
            aria-label="复制消息"
            title="复制消息"
            variant="ghost"
            onPress={onCopyMessage}
          >
            <CopyIcon />
          </Button>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                isIconOnly
                className="size-7 min-w-7 p-0"
                size="sm"
                aria-label="更多消息操作"
                title="更多消息操作"
                variant="ghost"
              >
                <MenuDotsIcon size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="消息操作">
              <DropdownItem
                key="delete"
                startContent={<Icon icon="trash" width={16} />}
                onPress={onDeleteMessage}
              >
                删除
              </DropdownItem>
              {!isUser && (
                <DropdownItem
                  key="regenerate"
                  startContent={<Icon icon="refresh" width={16} />}
                  onPress={onRegenerateMessage}
                >
                  重新生成
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        </>
      )}
    </div>
  </article>
);

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  requestId?: string;
}

// 定义组件ref的类型
export interface PromptContainerRef {
  sendMessage: (content: string) => void;
}

const EMPTY_MESSAGES: Message[] = [];

interface PromptContainerProps {
  onMessagesChange?: (messages: Message[]) => void;
  onSubmit?: (prompt: string, signal?: AbortSignal) => Promise<string>;
  onStopGeneration?: () => void;
  initialMessages?: Message[];
  className?: string;
  placeholder?: string;
  showAttachButtons?: boolean;
  onApplyCode?: (code: string) => void;
  editorContent?: string; // 编辑器内容，用于AI分析
  useDirectApi?: boolean; // 是否直接使用API而不通过父组件的onSubmit
  // 差异编辑器相关属性
  isDiffEditor?: boolean; // 是否是差异编辑器
  onApplyCodeToLeft?: (code: string) => void; // 应用到左侧编辑器
  onApplyCodeToRight?: (code: string) => void; // 应用到右侧编辑器
}

const PromptContainer = forwardRef<PromptContainerRef, PromptContainerProps>(
  (
    {
      onSubmit,
      onMessagesChange,
      onStopGeneration,
      initialMessages = EMPTY_MESSAGES,
      className,
      placeholder = "继续描述你想如何处理数据…",
      onApplyCode,
      editorContent = "",
      useDirectApi = false,
      isDiffEditor = false,
      onApplyCodeToLeft,
      onApplyCodeToRight,
    },
    ref,
  ) => {
    const hasModel = useOpenAIConfigStore((state) => !!state.getCurrentModel());
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    useEffect(() => {
      onMessagesChange?.(messages);
    }, [messages, onMessagesChange]);
    const [prompt, setPrompt] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    // 获取设置中的聊天样式
    const { chatStyle } = useSettingsStore();

    // AI控制器引用
    const requestSlot = useRef(new AIRequestSlot());

    useEffect(() => () => requestSlot.current.cancel(), []);

    // 自动滚动到最新消息
    const scrollToBottom = () => {
      if (scrollContainerRef.current) {
        const { scrollHeight, clientHeight } = scrollContainerRef.current;

        scrollContainerRef.current.scrollTop = messages.length
          ? scrollHeight - clientHeight
          : 0;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    };

    useEffect(() => {
      // 使用requestAnimationFrame确保DOM已更新
      const frame = requestAnimationFrame(() => {
        scrollToBottom();
      });

      return () => cancelAnimationFrame(frame);
    }, [messages]);

    // 直接向OpenAI发送请求的方法
    const sendToOpenAI = async (
      userPrompt: string,
      controller: AbortController,
      loadingMessage: Message,
    ): Promise<string> => {
      try {
        // 使用OpenAI服务
        const openAiService = OpenAIService.createInstance();

        // 修改AI系统提示
        const messages = [
          {
            role: "system" as const,
            content:
              "您是一个JSON工具助手，请帮助用户解决JSON相关问题。您可以：\n1. 返回纯代码，请使用```json```包裹代码\n2. 返回解释性文本，使用Markdown格式进行排版\n\n请根据问题类型选择最合适的回复格式。只提供json业务、编码和技术相关的回答，其他不相关的请拒绝回答。",
          },
          {
            role: "user" as const,
            content: `${userPrompt}\n\n以下是用户的JSON数据:\n\`\`\`json\n${editorContent || ""}\n\`\`\``,
          },
        ];

        if (messages[1].content.length > openAiService.maxTokens) {
          throw new Error("内容超出限制，请缩短内容或使用其他方式描述需求。");
        }

        let response = "";

        await openAiService.createChatCompletion(
          messages,
          {
            onChunk: (_chunk, accumulated) => {
              if (!requestSlot.current.owns(controller)) return;
              response = accumulated;
              setMessages((prev) => {
                if (!requestSlot.current.owns(controller)) return prev;

                return prev.map((message) =>
                  message.requestId === loadingMessage.requestId
                    ? { ...message, content: accumulated }
                    : message,
                );
              });
            },
            onComplete: (final) => {
              if (requestSlot.current.owns(controller)) response = final;
            },
            onError: (error) => {
              if (!requestSlot.current.owns(controller)) return;
              response = `处理您的请求时发生错误: ${error.message || "未知错误"}`;
              toast.error(`AI响应错误：${error.message || "请稍后重试"}`);
            },
          },
          { signal: controller.signal },
        );

        return response;
      } catch (error: any) {
        console.error("AI请求失败:", error);

        return `请求处理失败: ${error?.message || "未知错误"}`;
      }
    };

    // 复制消息
    const handleCopyMessage = (content: string) => {
      writeClipboardText(content)
        .then(() => toast.success("已复制到剪贴板"))
        .catch(() => toast.error("复制失败"));
    };

    // 删除消息
    const handleDeleteMessage = (index: number) => {
      setMessages((prevMessages) => prevMessages.filter((_, i) => i !== index));
    };

    // 删除并重新生成消息（找到前一个用户消息并重新提交）
    const handleRegenerateMessage = (index: number) => {
      // 删除当前消息及之后所有消息
      const newMessages = messages.slice(0, index);

      setMessages(newMessages);

      // 找到最后一个用户消息
      const lastUserMessage = [...newMessages]
        .reverse()
        .find((msg) => msg.role === "user");

      if (lastUserMessage) {
        // 重新发送该消息
        handleSendMessage(lastUserMessage.content);
      }
    };

    // 处理发送消息
    const handleSendMessage = async (customPrompt?: string) => {
      const messageContent = customPrompt || prompt;

      if (!messageContent.trim() || requestSlot.current.busy) return;

      const controller = requestSlot.current.start();
      const requestId = createAIRequestId();

      // 添加用户消息
      const userMessage: Message = {
        role: "user",
        content: messageContent,
        timestamp: Date.now(),
      };

      setMessages((prevMessages) => [...prevMessages, userMessage]);
      setPrompt("");

      setIsLoading(true);

      try {
        // 显示AI正在输入的状态
        const loadingMessage: Message = {
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          requestId,
        };

        setMessages((prevMessages) => [...prevMessages, loadingMessage]);

        let response: string;

        // 判断是直接使用API还是通过父组件的onSubmit
        if (useDirectApi) {
          response = await sendToOpenAI(
            messageContent,
            controller,
            loadingMessage,
          );
        } else {
          // 调用提交处理函数获取AI响应
          response =
            (await onSubmit?.(messageContent, controller.signal)) ||
            "抱歉，暂时无法处理您的请求。";
        }

        if (!requestSlot.current.owns(controller)) return;
        setMessages((previous) => {
          if (controller.signal.aborted) return previous;

          return previous.map((message) =>
            message.requestId === requestId
              ? { ...message, content: response }
              : message,
          );
        });
      } catch (error) {
        if (!requestSlot.current.owns(controller)) return;
        console.error("发送消息时出错:", error);
        setMessages((previous) => {
          if (controller.signal.aborted) return previous;

          return previous.map((message) =>
            message.requestId === requestId
              ? { ...message, content: "处理您的请求时发生错误，请稍后再试。" }
              : message,
          );
        });
      } finally {
        if (requestSlot.current.owns(controller)) {
          requestSlot.current.finish(controller);
          setIsLoading(false);
        }
      }
    };

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      sendMessage: (content: string) => {
        handleSendMessage(content);
      },
    }));

    // 处理按钮点击，根据当前状态决定是发送消息还是停止生成
    const handleButtonClick = () => {
      if (isLoading) {
        // 如果正在加载中，点击按钮停止生成
        requestSlot.current.cancel();
        setIsLoading(false);
        onStopGeneration?.();
      } else {
        // 否则发送消息
        handleSendMessage();
      }
    };

    const renderMessages = () => (
      <div className="flex w-full flex-col gap-6 pb-2">
        {messages.map((message, index) => {
          const pending =
            isLoading &&
            index === messages.length - 1 &&
            message.role === "assistant";
          return (
            <MessageCard
              key={message.timestamp + index}
              isUser={message.role === "user"}
              isLoading={pending}
              documentStyle={chatStyle === "document"}
              timestamp={message.timestamp}
              onCopyMessage={() => handleCopyMessage(message.content)}
              onDeleteMessage={() => handleDeleteMessage(index)}
              onRegenerateMessage={() => handleRegenerateMessage(index)}
              message={
                message.role === "user" ? (
                  message.content
                ) : pending && !message.content ? (
                  <div
                    className="flex items-center gap-2 text-muted-foreground"
                    role="status"
                  >
                    <span className="size-1.5 animate-pulse rounded-full bg-[var(--ai-accent)]" />
                    正在分析数据…
                  </div>
                ) : (
                  <MarkdownRenderer
                    className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_code]:break-words [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_img]:max-w-full"
                    content={message.content}
                    isDiffEditor={isDiffEditor}
                    onApplyCode={onApplyCode}
                    onApplyCodeToLeft={onApplyCodeToLeft}
                    onApplyCodeToRight={onApplyCodeToRight}
                  />
                )
              }
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    );
    return (
      <div
        className={cn(
          "ai-surface ai-conversation flex h-full min-h-0 w-full flex-col",
          className,
        )}
      >
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollContainerRef}
            className="absolute inset-0 overflow-x-hidden overflow-y-auto px-4 py-5"
          >
            {messages.length ? (
              renderMessages()
            ) : (
              <div className="flex min-h-full flex-col justify-center py-6">
                <span className="ai-emblem mb-5">
                  <Orbit className="size-4" />
                </span>
                <h3 className="text-xl font-medium tracking-tight">
                  你的数据，
                  <br />
                  下一步做什么？
                </h3>
                <p className="mb-6 mt-2 text-xs leading-relaxed text-muted-foreground">
                  描述目标，让 AI 帮你理解、修复或转换 JSON。
                </p>
                <div className="grid gap-2">
                  {[
                    {
                      label: "修复 JSON",
                      detail: "检查并修复语法错误",
                      icon: WandSparkles,
                      prompt: "请修复当前 JSON 的语法错误，并解释修改内容。",
                    },
                    {
                      label: "解释结构",
                      detail: "快速理解字段与数据关系",
                      icon: ScanText,
                      prompt: "请解释当前 JSON 的结构和字段含义。",
                    },
                    {
                      label: "转换字段",
                      detail: "将字段名统一为 camelCase",
                      icon: CaseSensitive,
                      prompt:
                        "请将当前 JSON 的所有字段名转换为 camelCase，保留原始数据值。",
                    },
                  ].map((item) => (
                    <Button
                      key={item.label}
                      className="ai-quick-action"
                      variant="outline"
                      onPress={() => {
                        setPrompt(item.prompt);
                        inputRef.current?.focus();
                      }}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>
                        <span className="block text-xs font-medium">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {item.detail}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="ai-input-area">
          <form
            className="ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isLoading) void handleSendMessage();
            }}
          >
            <textarea
              ref={inputRef}
              aria-label="AI 提示输入"
              rows={3}
              placeholder={placeholder}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229)
                  return;
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.metaKey &&
                  !event.ctrlKey
                ) {
                  event.preventDefault();
                  if (!isLoading && hasModel && prompt.trim())
                    void handleSendMessage();
                }
              }}
            />
            <div className="ai-composer-footer">
              <span className="ai-composer-hint">
                Enter 发送 · Shift + Enter 换行
              </span>
              <div className="ai-composer-actions">
                <AIModelPicker disabled={isLoading} />
                <Button
                  className={cn(
                    "ai-send-button",
                    isLoading && "ai-stop-button",
                  )}
                  isIconOnly
                  aria-label={isLoading ? "停止生成" : "发送消息"}
                  title={isLoading ? "停止生成" : "发送消息"}
                  color={isLoading ? "danger" : "default"}
                  size="sm"
                  isDisabled={!isLoading && (!hasModel || !prompt.trim())}
                  onPress={handleButtonClick}
                >
                  {isLoading ? (
                    <Square className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUp aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
          </form>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="ml-auto">{prompt.length} 字</span>
          </div>
        </div>
      </div>
    );
  },
);

PromptContainer.displayName = "PromptContainer";

export default PromptContainer;
