import {
  ChoiceCard,
  GroupLabel,
  SectionCard,
  SectionHeader,
} from "../settingPrimitives";

import {
  useSettingsStore,
  type ChatStyle,
  type FontSize,
} from "@/store/useSettingsStore";
import toast from "@/utils/toast";

const FONT_OPTIONS: Array<{
  value: FontSize;
  label: string;
  desc: string;
  previewSize: string;
}> = [
  { value: "small", label: "小号", desc: "紧凑省空间", previewSize: "13px" },
  { value: "medium", label: "标准", desc: "平衡阅读", previewSize: "16px" },
  { value: "large", label: "大号", desc: "清晰易见", previewSize: "19px" },
];

/**
 * 外观设置（Apple 系统风）：聊天样式 + 字体大小，均用可视化选择卡片。
 */
export function AppearanceSettings() {
  const chatStyle = useSettingsStore((s) => s.chatStyle);
  const setChatStyle = useSettingsStore((s) => s.setChatStyle);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);

  const handleStyleChange = (style: ChatStyle) => {
    setChatStyle(style);
    toast.success("聊天窗口样式已更改");
  };

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    toast.success("字体大小已更改");
  };

  return (
    <div className="h-full">
      <SectionHeader
        description="自定义应用的外观和显示方式"
        title="外观设置"
      />

      <GroupLabel>聊天窗口样式</GroupLabel>
      <SectionCard>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
          <ChoiceCard
            selected={chatStyle === "bubble"}
            onSelect={() => handleStyleChange("bubble")}
          >
            <div className="mb-2.5 flex h-[68px] items-center rounded-md bg-secondary p-2.5">
              <div className="flex w-full flex-col gap-1.5">
                <div className="h-2 w-full rounded-full bg-primary/40" />
                <div className="ml-auto h-2 w-3/5 rounded-full bg-input" />
                <div className="h-2 w-[90%] rounded-full bg-primary/40" />
              </div>
            </div>
            <p className="text-[12.5px] font-semibold text-foreground">
              气泡模式
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              左右分列的对话气泡
            </p>
          </ChoiceCard>

          <ChoiceCard
            selected={chatStyle === "document"}
            onSelect={() => handleStyleChange("document")}
          >
            <div className="mb-2.5 flex h-[68px] items-center rounded-md bg-secondary p-2.5">
              <div className="flex w-full flex-col gap-1.5">
                <div className="h-1.5 w-full rounded-sm bg-primary/40" />
                <div className="h-1.5 w-full rounded-sm bg-input" />
                <div className="h-1.5 w-3/4 rounded-sm bg-primary/40" />
                <div className="h-1.5 w-full rounded-sm bg-input" />
              </div>
            </div>
            <p className="text-[12.5px] font-semibold text-foreground">
              文档模式
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              上下排列的文档流
            </p>
          </ChoiceCard>
        </div>
      </SectionCard>

      <GroupLabel>字体大小</GroupLabel>
      <SectionCard>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 sm:p-4">
          {FONT_OPTIONS.map((opt) => (
            <ChoiceCard
              key={opt.value}
              selected={fontSize === opt.value}
              onSelect={() => handleFontSizeChange(opt.value)}
            >
              <div
                className="mb-2 font-semibold text-foreground"
                style={{ fontSize: opt.previewSize }}
              >
                Aa 示例
              </div>
              <p className="text-[12px] font-semibold text-foreground">
                {opt.label}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {opt.desc}
              </p>
            </ChoiceCard>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
