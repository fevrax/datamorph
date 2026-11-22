import { t } from "@/i18n";
import { useLocale } from "@/i18n/useLocale";
import { TimeZoneSelector } from "../TimeZoneSelector";
import { resolveTimeZone } from "@/utils/timeZone";
import { Switch } from "@/components/ui";

import {
  ControlSlot,
  InfoNote,
  SectionCard,
  SectionHeader,
  SettingRow,
  type SettingTone,
} from "../settingPrimitives";

import toast from "@/utils/toast";
import { useSettingsStore } from "@/store/useSettingsStore";
/** 单个解码器行 */
interface DecoderItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: SettingTone;
}

const DECODERS: DecoderItem[] = [
  {
    id: "embeddedJson",
    get title() {
      return t("字符串内 JSON 展开");
    },
    get description() {
      return t("悬浮查看字符串中的 JSON，支持复制和新标签打开");
    },
    icon: "braces",
    tone: "info",
  },
  {
    id: "color",
    get title() {
      return t("颜色预览");
    },
    get description() {
      return t("识别 HEX、RGB、HSL 颜色并显示色块");
    },
    icon: "palette",
    tone: "violet",
  },
  {
    id: "summary",
    get title() {
      return t("折叠摘要");
    },
    get description() {
      return t("仅在折叠后显示 Object { len }、Array [ len ]");
    },
    icon: "list-tree",
    tone: "neutral",
  },
  {
    id: "image",
    get title() {
      return t("图片预览");
    },
    get description() {
      return t("识别图片链接，按需打开预览");
    },
    icon: "image",
    tone: "neutral",
  },
  {
    id: "timestamp",
    get title() {
      return t("时间戳解码器");
    },
    get description() {
      return t("自动识别并转换时间戳为人类可读的日期时间格式");
    },
    icon: "solar:clock-circle-bold",
    tone: "info",
  },
  {
    id: "base64",
    get title() {
      return t("Base64 解码器");
    },
    get description() {
      return t("自动识别并解码 Base64 编码的字符串");
    },
    icon: "ph:binary-fill",
    tone: "violet",
  },
  {
    id: "unicode",
    get title() {
      return t("Unicode 解码器");
    },
    get description() {
      return t("自动识别并转换 Unicode 转义序列为可读字符");
    },
    icon: "solar:global-bold",
    tone: "violet",
  },
  {
    id: "url",
    get title() {
      return t("URL 解码器");
    },
    get description() {
      return t("自动识别并转换URL编码序列为可读字符");
    },
    icon: "solar:link-bold",
    tone: "warning",
  },
];

/**
 * 解码器设置：时间戳 / Base64 / Unicode / URL。开关会同步触发 monaco 装饰副作用。
 * 行为与原 settingPage.renderDecoderSettings 一致。
 */
export function DecoderSettings() {
  useLocale();
  const {
    timestampDecoderEnabled,
    timestampTimeZone,
    base64DecoderEnabled,
    unicodeDecoderEnabled,
    urlDecoderEnabled,
    setTimestampDecoderEnabled,
    setBase64DecoderEnabled,
    setUnicodeDecoderEnabled,
    setUrlDecoderEnabled,
  } = useSettingsStore();

  const handleToggle = (id: string, value: boolean) => {
    switch (id) {
      case "embeddedJson":
        useSettingsStore.getState().setEmbeddedJsonDecoderEnabled(value);
        break;
      case "color":
        useSettingsStore.getState().setColorDecoderEnabled(value);
        break;
      case "summary":
        useSettingsStore.getState().setSummaryDecoderEnabled(value);
        break;
      case "image":
        useSettingsStore.getState().setImageDecoderEnabled(value);
        break;
      case "timestamp":
        setTimestampDecoderEnabled(value);
        toast.success(
          t("时间戳解码器已{0}", { 0: value ? t("启用") : t("禁用") }),
        );
        break;
      case "base64":
        setBase64DecoderEnabled(value);
        toast.success(
          t("Base64解码器已{0}", { 0: value ? t("启用") : t("禁用") }),
        );
        break;
      case "unicode":
        setUnicodeDecoderEnabled(value);
        toast.success(
          t("Unicode解码器已{0}", { 0: value ? t("启用") : t("禁用") }),
        );
        break;
      case "url":
        setUrlDecoderEnabled(value);
        toast.success(
          t("URL解码器已{0}", { 0: value ? t("启用") : t("禁用") }),
        );
        break;
    }
  };

  const enabledMap: Record<string, boolean> = {
    embeddedJson: useSettingsStore((s) => s.embeddedJsonDecoderEnabled),
    color: useSettingsStore((s) => s.colorDecoderEnabled),
    summary: useSettingsStore((s) => s.summaryDecoderEnabled),
    image: useSettingsStore((s) => s.imageDecoderEnabled),
    timestamp: timestampDecoderEnabled,
    base64: base64DecoderEnabled,
    unicode: unicodeDecoderEnabled,
    url: urlDecoderEnabled,
  };

  return (
    <div className="h-full">
      <SectionHeader
        description={t("管理编辑器中各种解码器的显示和行为")}
        title={t("解码器设置")}
      />

      <SectionCard divided>
        {DECODERS.map((d) => (
          <SettingRow
            key={d.id}
            description={d.description}
            icon={d.icon}
            title={d.title}
            tone={d.tone}
          >
            <ControlSlot>
              <Switch
                color="success"
                aria-label={d.title}
                isSelected={enabledMap[d.id]}
                size="lg"
                onValueChange={(value) => handleToggle(d.id, value)}
              />
            </ControlSlot>
          </SettingRow>
        ))}

        <SettingRow
          description={t(
            "当前时区：{0}。默认跟随本地时区，修改后同步到所有时间戳提示。",
            { 0: resolveTimeZone(timestampTimeZone) },
          )}
          icon="solar:global-bold"
          title={t("时间戳时区")}
          tone="info"
        >
          <ControlSlot className="w-full sm:w-60 sm:shrink-0">
            <TimeZoneSelector />
          </ControlSlot>
        </SettingRow>

        <InfoNote title={t("关于解码器")}>
          <p>
            {t(
              "解码器可以自动识别并转换特定格式的数据，使其更易读。这些设置在所有编辑器中全局生效。",
            )}
          </p>
          <p>{t("如果程序出现卡顿等性能问题，可以尝试关闭部分解码器。")}</p>
        </InfoNote>
      </SectionCard>
    </div>
  );
}
