import React from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { ArrowUp, Orbit } from "lucide-react";
import "./assistant.css";

import { useOpenAIConfigStore } from "@/store/useOpenAIConfigStore";
import AIModelPicker from "./AIModelPicker";

// 快捷指令类型定义
export interface QuickPrompt {
  id: string;
  label: string;
  icon?: string;
  prompt: string;
  color?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "default";
  handler?: () => void; // 可选的自定义处理函数
}

interface AIPromptOverlayProps {
  isOpen: boolean;
  prompt: string;
  placeholderText?: string;
  tipText?: string;
  tipIcon?: string;
  quickPrompts?: QuickPrompt[]; // 新增：快捷指令数组
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onQuickPromptClick?: (quickPrompt: QuickPrompt) => void; // 新增：自定义快捷指令点击处理函数
}

const AIPromptOverlay: React.FC<AIPromptOverlayProps> = ({
  isOpen,
  prompt,
  placeholderText = "输入您的问题...",
  tipText = "提示: 您可以让AI为您处理关于数据修复，数据优化，模拟数据生成等问题",
  tipIcon = "mdi:lightbulb-outline",
  quickPrompts = [], // 默认为空数组
  onPromptChange,
  onSubmit,
  onClose,
  onQuickPromptClick,
}) => {
  const hasModel = useOpenAIConfigStore((state) => !!state.getCurrentModel());
  const routeType = useOpenAIConfigStore((state) => state.routeType);
  const isCustomRouteAvailable = useOpenAIConfigStore(
    (state) => !!state.customRoute.apiKey && !!state.customRoute.proxyUrl,
  );

  // 处理快捷指令点击
  const handleQuickPromptClick = (quickPrompt: QuickPrompt) => {
    // 如果传入了自定义点击处理函数，则使用它
    if (onQuickPromptClick) {
      onQuickPromptClick(quickPrompt);

      return;
    }

    // 如果有自定义处理函数，则执行它
    if (quickPrompt.handler) {
      quickPrompt.handler();

      return;
    }

    // 否则执行默认行为：替换提示文本
    onPromptChange(quickPrompt.prompt);
  };

  const canSubmit =
    hasModel &&
    !!prompt.trim() &&
    !(routeType === "custom" && !isCustomRouteAvailable);
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent className="ai-surface ai-prompt-modal">
        <ModalHeader className="flex items-center gap-3 px-6 pb-2 pt-6 text-sm font-medium">
          <span className="ai-emblem">
            <Orbit className="size-4" />
          </span>
          AI 助手
          <span className="ml-auto mr-6 text-[10px] font-normal tracking-[0.18em] text-muted-foreground">
            JSON COPILOT
          </span>
        </ModalHeader>
        <ModalBody className="px-6">
          <div className="ai-prompt-intro">
            <h2>你的数据，下一步做什么？</h2>
            <p>描述处理目标，让 AI 帮你理解、修复或转换数据。</p>
          </div>
          <div className="ai-composer">
            <textarea
              aria-label="AI 提示输入"
              placeholder={placeholderText}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              rows={4}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey) &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault();
                  if (canSubmit) onSubmit();
                }
              }}
            />
            <div className="ai-composer-footer ai-composer-toolbar">
              <span className="ai-composer-hint">⌘ / Ctrl + Enter 发送</span>
              <div className="ai-composer-actions">
                <AIModelPicker />
                <Button
                  className="ai-send-button"
                  isIconOnly
                  aria-label="发送提问"
                  title="发送提问"
                  isDisabled={!canSubmit}
                  onPress={onSubmit}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
          {quickPrompts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {quickPrompts.map((quick) => (
                <Button
                  key={quick.id}
                  className="ai-quick-action"
                  size="sm"
                  variant="outline"
                  onPress={() => handleQuickPromptClick(quick)}
                >
                  {quick.icon && (
                    <Icon icon={quick.icon} className="size-3.5 shrink-0" />
                  )}
                  {quick.label}
                </Button>
              ))}
            </div>
          )}
          <p className="mb-5 mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Icon icon={tipIcon} className="size-3.5 shrink-0" />
            {tipText}
          </p>
          {routeType === "custom" && !isCustomRouteAvailable && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              私有API尚未配置，请在设置中填写接口地址和密钥。
            </p>
          )}
        </ModalBody>
        <ModalFooter className="px-6 pb-5 pt-2">
          <Button variant="ghost" size="sm" onPress={onClose}>
            取消
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
export default AIPromptOverlay;
