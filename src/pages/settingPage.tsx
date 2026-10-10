import { useState } from "react";

import {
  SettingsSidebar,
  type SettingsMenuItem,
} from "@/components/setting/SettingsSidebar";
import { GeneralSettings } from "@/components/setting/sections/GeneralSettings";
import { ShortcutsSettings } from "@/components/setting/sections/ShortcutsSettings";
import { AppearanceSettings } from "@/components/setting/sections/AppearanceSettings";
import { DecoderSettings } from "@/components/setting/sections/DecoderSettings";
import { AISettings } from "@/components/setting/sections/AISettings";
import { AboutContent } from "@/components/setting/sections/AboutContent";

/**
 * 设置页（壳）。
 *
 * 仅负责：左侧二级导航 + 内容区 tab 路由 + 响应式布局 + 切换动画。
 * 各 tab 的实现拆分到 src/components/setting/sections/*。
 * 根容器挂在全站 FontSizeLayout 之下，字号随全局 small/medium/large 缩放。
 */
const MENU_ITEMS: SettingsMenuItem[] = [
  { key: "general", label: "通用设置", icon: "solar:settings-bold" },
  { key: "shortcuts", label: "快捷键", icon: "solar:keyboard-bold" },
  { key: "appearance", label: "外观设置", icon: "catppuccin:folder-themes" },
  { key: "decoders", label: "自动解码", icon: "solar:code-bold" },
  { key: "ai", label: "AI 助手", icon: "hugeicons:ai-chat-02" },
  { key: "about", label: "关于", icon: "solar:info-circle-bold" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralSettings />;
      case "shortcuts":
        return <ShortcutsSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "decoders":
        return <DecoderSettings />;
      case "ai":
        return <AISettings />;
      case "about":
        return <AboutContent />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-1 bg-muted dark:bg-muted/5">
      <div className="flex h-full w-full min-w-0 flex-row overflow-hidden">
        <SettingsSidebar
          activeTab={activeTab}
          items={MENU_ITEMS}
          onSelect={setActiveTab}
        />

        <div className="min-w-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 md:px-6 md:py-6">
          <div key={activeTab} className="mx-auto w-full max-w-[960px] pb-8">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
