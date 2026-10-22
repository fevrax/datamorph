import {
  Button,
  Select,
  SelectItem,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Slider,
  Switch,
  Tooltip,
  useDisclosure,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { useState } from "react";
import { useTheme } from "next-themes";

import {
  ControlSlot,
  GroupLabel,
  SectionCard,
  SectionHeader,
  SettingRow,
} from "../settingPrimitives";

import toast from "@/utils/toast";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useTabStore } from "@/store/useTabStore";
import { storage } from "@/lib/indexedDBStore";
import { useOpenAIConfigStore } from "@/store/useOpenAIConfigStore";

/**
 * 通用设置（Apple 系统风）：按「外观 / 编辑器 / 数据 / 危险操作」分组。
 */
export function GeneralSettings() {
  const {
    expandSidebar,
    defaultIndentSize,
    persistentDataEnabled,
    setExpandSidebar,
    setPersistentDataEnabled,
    setDefaultIndentSize,
  } = useSettingsStore();

  const { theme, setTheme } = useTheme();

  const {
    isOpen: isConfirmOpen,
    onOpen: onConfirmOpen,
    onClose: onConfirmClose,
  } = useDisclosure();
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const handlePersistenceChange = (value: boolean) => {
    if (!value) {
      setPendingValue(value);
      onConfirmOpen();
    } else {
      setPersistentDataEnabled(value);
      toast.success("已开启本地存储，您的数据将被自动保存");
    }
  };

  const handleConfirmDisablePersistence = () => {
    if (pendingValue !== null) {
      setPersistentDataEnabled(pendingValue);
      toast.success("已暂停本地保存，已有数据已保留");
      setPendingValue(null);
      onConfirmClose();
    }
  };

  const handleIndentChange = (value: number | number) => {
    setDefaultIndentSize(value as number);
    toast.success(`默认缩进大小已设置为 ${value} 个空格`);
  };

  const removeStore = async () => {
    await useTabStore.getState().clearUserData();
    await storage.clear();
    useSettingsStore.setState({
      expandSidebar: true,
      imageDecoderEnabled: true,
      persistentDataEnabled: true,
      fontSize: "medium",
      monacoEditorCDN: "local",
      chatStyle: "bubble",
      timestampDecoderEnabled: true,
      timestampTimeZone: "local",
      base64DecoderEnabled: true,
      unicodeDecoderEnabled: true,
      urlDecoderEnabled: true,
      defaultIndentSize: 4,
      newTabShortcut: "Ctrl+Shift+T",
      closeTabShortcut: "Ctrl+Shift+W",
    });
    useOpenAIConfigStore.getState().resetConfig();
    setTheme("system");
    setResetOpen(false);
    toast.success("所有设置已重置，请重新加载或刷新页面");
  };

  return (
    <div className="h-full">
      <SectionHeader description="管理应用的基本设置和偏好" title="通用设置" />

      <GroupLabel>外观</GroupLabel>
      <SectionCard divided>
        <SettingRow
          description="浅色、深色或跟随系统外观"
          icon="solar:moon-bold"
          title="界面主题"
          tone="primary"
        >
          <ControlSlot>
            <Select
              aria-label="界面主题"
              selectedKeys={[theme || "system"]}
              onChange={(event) => setTheme(event.target.value)}
            >
              <SelectItem key="system">跟随系统</SelectItem>
              <SelectItem key="light">浅色</SelectItem>
              <SelectItem key="dark">深色</SelectItem>
            </Select>
          </ControlSlot>
        </SettingRow>
        <SettingRow
          description="应用启动时默认展开侧边栏"
          icon="solar:square-top-down-bold"
          title="展开侧边栏"
          tone="info"
        >
          <ControlSlot>
            <Switch
              color="success"
              isSelected={expandSidebar}
              size="lg"
              onValueChange={(value) => setExpandSidebar(value)}
            />
          </ControlSlot>
        </SettingRow>
      </SectionCard>

      <GroupLabel>编辑器</GroupLabel>
      <SectionCard>
        <SettingRow
          description="新标签页 JSON 的缩进空格数"
          icon="fluent:text-indent-increase-16-filled"
          title="默认缩进大小"
          tone="warning"
        >
          <ControlSlot className="sm:min-w-[220px]" align="stretch">
            <span className="w-5 text-center text-sm font-medium tabular-nums text-muted-foreground">
              {defaultIndentSize}
            </span>
            <Slider
              aria-label="调整默认缩进大小"
              className="min-w-[140px] flex-1 sm:w-40"
              color="primary"
              maxValue={8}
              minValue={1}
              step={1}
              value={defaultIndentSize}
              onChange={(value) => handleIndentChange(value as number)}
            />
          </ControlSlot>
        </SettingRow>
      </SectionCard>

      <GroupLabel>数据</GroupLabel>
      <SectionCard>
        <SettingRow
          description={
            persistentDataEnabled
              ? "已开启，数据自动保存到本地"
              : "当前已关闭，刷新页面后数据将丢失"
          }
          icon="lucide:database"
          title="本地数据持久化"
          tone={persistentDataEnabled ? "success" : "warning"}
        >
          <ControlSlot>
            <Switch
              color="success"
              isSelected={persistentDataEnabled}
              size="lg"
              onValueChange={handlePersistenceChange}
            />
          </ControlSlot>
        </SettingRow>
      </SectionCard>

      <GroupLabel>危险操作</GroupLabel>
      <SectionCard>
        <SettingRow
          description="清除所有本地存储并恢复默认设置"
          icon="solar:restart-bold"
          title="重置应用"
          tone="danger"
        >
          <ControlSlot>
            <Tooltip content="此操作将清除所有本地数据">
              <Button
                color="danger"
                radius="full"
                size="sm"
                startContent={<Icon icon="solar:refresh-bold" width={16} />}
                variant="flat"
                onPress={() => setResetOpen(true)}
              >
                重置…
              </Button>
            </Tooltip>
          </ControlSlot>
        </SettingRow>
      </SectionCard>

      <Modal isOpen={resetOpen} onClose={() => setResetOpen(false)}>
        <ModalContent>
          <ModalHeader>重置全部数据？</ModalHeader>
          <ModalBody>
            这将删除全部文档、历史记录、工具数据和 AI
            配置，并恢复默认设置。此操作无法撤销，请先下载需要保留的内容。
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setResetOpen(false)}>取消</Button>
            <Button color="danger" onPress={() => void removeStore()}>
              删除全部数据并重置
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {/* 确认关闭本地存储对话框 */}
      <Modal isOpen={isConfirmOpen} onClose={onConfirmClose}>
        <ModalContent>
          <ModalHeader>确认关闭本地存储？</ModalHeader>
          <ModalBody>
            <p>关闭后，您的所有用户数据（标签页、输入内容等）将不再保存。</p>
            <p className="mt-2 text-warning">
              已有本地快照会保留，关闭期间的更改只保留在当前窗口。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onConfirmClose}>
              取消
            </Button>
            <Button color="danger" onPress={handleConfirmDisablePersistence}>
              确认关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
