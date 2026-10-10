import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Clock3,
  Columns2,
  FileCode2,
  History,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui";
import ReadOnlyMonacoEditor from "@/components/monacoEditor/ReadOnlyMonacoEditor";
import type { TabHistoryItem } from "@/store/useTabStore";
import { snapshotBytes } from "@/store/documentHistory";
import HistoryDiffPreview from "./HistoryDiffPreview";
import "./tab-history.css";

interface TabHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  language: string;
  currentContent: string;
  historyItems: TabHistoryItem[];
  onRestore: (historyKey: string) => void;
  onOpenInNewTab: (item: TabHistoryItem) => void;
  onDelete: (historyKey: string) => void;
  onClear: () => void;
}
type Confirmation =
  | { type: "delete"; item: TabHistoryItem }
  | { type: "clear" };
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
function dayKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function dayLabel(timestamp: number) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(timestamp) === dayKey(today.getTime())) return "今天";
  if (dayKey(timestamp) === dayKey(yesterday.getTime())) return "昨天";
  return dateFormat.format(timestamp);
}
function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function TabHistoryModal({
  isOpen,
  onClose,
  documentTitle,
  language,
  currentContent,
  historyItems,
  onRestore,
  onOpenInNewTab,
  onDelete,
  onClear,
}: TabHistoryModalProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"content" | "diff">("content");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "vs-dark" : "vs-light";
  const records = useMemo(
    () => [...historyItems].sort((a, b) => b.timestamp - a.timestamp),
    [historyItems],
  );
  const groups = useMemo(() => {
    const days = new Map<string, { label: string; items: TabHistoryItem[] }>();
    for (const item of records) {
      const key = dayKey(item.timestamp);
      let group = days.get(key);
      if (!group) {
        group = { label: dayLabel(item.timestamp), items: [] };
        days.set(key, group);
      }
      group.items.push(item);
    }
    return [...days.entries()];
  }, [records]);
  const selected =
    records.find((item) => item.key === selectedKey) ?? records[0];
  const isCurrent = selected?.content === currentContent;
  function close() {
    setSelectedKey(null);
    setMode("content");
    setConfirmation(null);
    onClose();
  }
  function confirm() {
    if (confirmation?.type === "delete") {
      const index = records.findIndex(
        (item) => item.key === confirmation.item.key,
      );
      setSelectedKey(
        records[index + 1]?.key ?? records[index - 1]?.key ?? null,
      );
      onDelete(confirmation.item.key);
    } else if (confirmation?.type === "clear") {
      setSelectedKey(null);
      setMode("content");
      onClear();
    }
    setConfirmation(null);
  }
  return (
    <>
      <Modal isOpen={isOpen} size="5xl" onClose={close}>
        <ModalContent className="history-modal">
          <ModalHeader className="history-header">
            <div className="history-heading">
              <History className="size-5 text-primary" aria-hidden="true" />
              <span>历史记录</span>
              <span className="history-count">{records.length} 个版本</span>
            </div>
            <div className="history-document" title={documentTitle}>
              {documentTitle}
              <span>浏览已保存的内容，随时找回之前的版本</span>
            </div>
          </ModalHeader>
          {selected ? (
            <div className="history-layout">
              <aside className="history-sidebar" aria-label="历史版本列表">
                <div className="history-list-heading">
                  保存时间<span>从新到旧</span>
                </div>
                <div className="history-records">
                  {groups.map(([key, group]) => (
                    <section className="history-day" key={key}>
                      <h3>{group.label}</h3>
                      <div className="history-day-records">
                        {group.items.map((item) => (
                          <button
                            type="button"
                            key={item.key}
                            className="history-record"
                            aria-pressed={selected.key === item.key}
                            aria-label={`${dateFormat.format(item.timestamp)} ${timeFormat.format(item.timestamp)}，版本 ${item.revision}`}
                            onClick={() => setSelectedKey(item.key)}
                          >
                            <span className="history-record-marker">
                              <Clock3 aria-hidden="true" />
                            </span>
                            <span className="history-record-info">
                              <span className="history-record-time">
                                {timeFormat.format(item.timestamp)}
                                {item.key === records[0].key && (
                                  <span className="history-latest">最近</span>
                                )}
                              </span>
                              <span className="history-record-meta">
                                {item.content.length.toLocaleString()} 字符
                                <span>版本 {item.revision}</span>
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </aside>
              <section className="history-preview" aria-label="历史内容预览">
                <div className="history-preview-toolbar">
                  <div
                    className="history-mode"
                    role="group"
                    aria-label="预览方式"
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-pressed={mode === "content"}
                      onPress={() => setMode("content")}
                    >
                      <FileCode2 />
                      内容预览
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-pressed={mode === "diff"}
                      onPress={() => setMode("diff")}
                    >
                      <Columns2 />
                      与当前比较
                    </Button>
                  </div>
                  <span className="history-language">
                    {language.toUpperCase()}
                  </span>
                </div>
                <div className="history-preview-details" aria-live="polite">
                  <div>
                    <span className="history-preview-date">
                      {dateFormat.format(selected.timestamp)}
                      <span>{timeFormat.format(selected.timestamp)}</span>
                    </span>
                    <span className="history-preview-meta">
                      {selected.content.length.toLocaleString()} 字符 ·{" "}
                      {sizeLabel(snapshotBytes(selected))}
                    </span>
                  </div>
                  {isCurrent && (
                    <span className="history-same">与当前内容一致</span>
                  )}
                </div>
                {mode === "diff" && (
                  <div className="history-diff-labels">
                    <span>历史内容</span>
                    <span>当前内容</span>
                  </div>
                )}
                <div className="history-editor">
                  {mode === "content" ? (
                    <ReadOnlyMonacoEditor
                      value={selected.content}
                      theme={theme}
                      language={language}
                      ariaLabel="历史版本内容，只读"
                    />
                  ) : (
                    <HistoryDiffPreview
                      original={selected.content}
                      modified={currentContent}
                      theme={theme}
                      language={language}
                    />
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="history-empty">
              <span className="history-empty-icon">
                <History aria-hidden="true" />
              </span>
              <h3>还没有历史记录</h3>
              <p>编辑内容后会自动保存历史版本，可在这里预览和恢复。</p>
              <Button variant="flat" onPress={close}>
                继续编辑
              </Button>
            </div>
          )}
          {selected && (
            <ModalFooter className="history-footer">
              <div className="history-footer-start">
                <Dropdown>
                  <DropdownTrigger>
                    <Button size="sm" variant="ghost" aria-label="管理历史">
                      <MoreHorizontal />
                      管理历史
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="历史管理操作">
                    <DropdownItem
                      startContent={<Trash2 className="size-4" />}
                      onPress={() =>
                        setConfirmation({ type: "delete", item: selected })
                      }
                    >
                      删除此版本
                    </DropdownItem>
                    <DropdownItem
                      startContent={<Trash2 className="size-4" />}
                      className="text-destructive"
                      onPress={() => setConfirmation({ type: "clear" })}
                    >
                      清空所有历史
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
                <span className="history-restore-note">
                  <ShieldCheck aria-hidden="true" />
                  恢复前保留当前版本
                </span>
              </div>
              <div className="history-footer-actions">
                <Button
                  onPress={() => {
                    onOpenInNewTab(selected);
                    close();
                  }}
                >
                  <SquareArrowOutUpRight />
                  新标签打开
                </Button>
                <Button
                  color="primary"
                  isDisabled={isCurrent}
                  onPress={() => {
                    onRestore(selected.key);
                    close();
                  }}
                >
                  <RotateCcw />
                  恢复此版本
                </Button>
              </div>
            </ModalFooter>
          )}
        </ModalContent>
      </Modal>
      <Modal
        isOpen={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
      >
        <ModalContent>
          <ModalHeader>
            {confirmation?.type === "clear"
              ? "清空所有历史记录？"
              : "删除此历史版本？"}
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-muted-foreground">
              {confirmation?.type === "clear"
                ? `将删除 ${records.length} 个历史版本，当前文档内容会保留。此操作无法撤销。`
                : confirmation &&
                  `将删除 ${dateFormat.format(confirmation.item.timestamp)} ${timeFormat.format(confirmation.item.timestamp)} 保存的版本，当前文档内容会保留。此操作无法撤销。`}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button onPress={() => setConfirmation(null)}>取消</Button>
            <Button color="danger" onPress={confirm}>
              {confirmation?.type === "clear" ? "确认清空" : "确认删除"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
