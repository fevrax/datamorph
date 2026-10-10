import { Input } from "@/components/ui";

import {
  ControlSlot,
  InfoNote,
  SectionCard,
  SectionHeader,
  SettingRow,
} from "../settingPrimitives";

import toast from "@/utils/toast";
import { parseShortcut } from "@/utils/shortcut";
import { useSettingsStore } from "@/store/useSettingsStore";

/**
 * 快捷键设置：新建 / 关闭标签页。支持在输入框按下组合键自动捕获。
 * 行为与原 settingPage.renderShortcutsSettings 一致。
 */
export function ShortcutsSettings() {
  const newTabShortcut = useSettingsStore((s) => s.newTabShortcut);
  const closeTabShortcut = useSettingsStore((s) => s.closeTabShortcut);
  const setNewTabShortcut = useSettingsStore((s) => s.setNewTabShortcut);
  const setCloseTabShortcut = useSettingsStore((s) => s.setCloseTabShortcut);

  const handleShortcutChange = (shortcutType: string, newShortcut: string) => {
    try {
      const config = parseShortcut(newShortcut);

      if (!config.key) {
        toast.error("无效的快捷键格式");

        return;
      }

      if (shortcutType === "newTab") {
        setNewTabShortcut(newShortcut);
        toast.success(`新建标签页快捷键已设置为 ${newShortcut}`);
      } else if (shortcutType === "closeTab") {
        setCloseTabShortcut(newShortcut);
        toast.success(`关闭标签页快捷键已设置为 ${newShortcut}`);
      }
    } catch {
      toast.error("快捷键格式错误，请使用如 Ctrl+Shift+T 的格式");
    }
  };

  // 捕获组合键，转成 Ctrl+Shift+T 形式
  const captureShortcut = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
      e.preventDefault();
      const modifiers: string[] = [];

      if (e.ctrlKey) modifiers.push("Ctrl");
      if (e.altKey) modifiers.push("Alt");
      if (e.shiftKey) modifiers.push("Shift");
      if (e.metaKey) modifiers.push("Cmd");
      const key = e.key.toUpperCase();
      const shortcut = [...modifiers, key].join("+");

      return shortcut;
    }

    return null;
  };

  const Hint = () => (
    <div className="whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
      按组合键设置
    </div>
  );

  return (
    <div className="h-full">
      <SectionHeader description="自定义应用的快捷键操作" title="快捷键设置" />

      <SectionCard divided>
        <SettingRow
          description="快速创建新的空白标签页"
          icon="solar:document-add-bold"
          title="新建标签页"
          tone="success"
        >
          <ControlSlot className="sm:min-w-[280px]" align="stretch">
            <Input
              className="min-w-[150px] flex-1 sm:w-48"
              placeholder="Ctrl+Shift+T"
              size="sm"
              value={newTabShortcut}
              variant="bordered"
              onChange={(e) => handleShortcutChange("newTab", e.target.value)}
              onKeyDown={(e) => {
                const shortcut = captureShortcut(e);

                if (shortcut) handleShortcutChange("newTab", shortcut);
              }}
            />
            <Hint />
          </ControlSlot>
        </SettingRow>

        <SettingRow
          description="快速关闭当前活动的标签页"
          icon="solar:close-circle-bold"
          title="关闭标签页"
          tone="danger"
        >
          <ControlSlot className="sm:min-w-[280px]" align="stretch">
            <Input
              className="min-w-[150px] flex-1 sm:w-48"
              placeholder="Ctrl+Shift+W"
              size="sm"
              value={closeTabShortcut}
              variant="bordered"
              onChange={(e) => handleShortcutChange("closeTab", e.target.value)}
              onKeyDown={(e) => {
                const shortcut = captureShortcut(e);

                if (shortcut) handleShortcutChange("closeTab", shortcut);
              }}
            />
            <Hint />
          </ControlSlot>
        </SettingRow>

        <InfoNote title="关于快捷键">
          <p>• 支持的修饰键：Ctrl、Alt、Shift、Cmd（Mac）</p>
          <p>• 支持的主键：字母键（A-Z）、数字键（0-9）</p>
          <p>• 示例格式：Ctrl+Shift+T、Cmd+Shift+T、Ctrl+T</p>
          <p>• 在输入框中按下组合键可自动设置</p>
        </InfoNote>
      </SectionCard>
    </div>
  );
}
