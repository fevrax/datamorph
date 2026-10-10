import { FileJson2, Orbit, X } from "lucide-react";
import { Button } from "@/components/ui";
import "./assistant.css";

export default function AIAssistantHeader({
  fileName,
  contextLabel,
  onClose,
}: {
  fileName: string;
  contextLabel: string;
  onClose: () => void;
}) {
  return (
    <header className="ai-dock-header">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="ai-emblem">
            <Orbit className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-medium">AI 助手</h2>
            <p className="mt-0.5 text-[10px] tracking-[0.18em] text-muted-foreground">
              JSON COPILOT
            </p>
          </div>
        </div>
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          aria-label="关闭辅助面板"
          onPress={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="ai-context">
        <span className="ai-file-tag" title={fileName}>
          <FileJson2 className="size-3.5 shrink-0" />
          <span className="truncate">{fileName}</span>
        </span>
        <span>{contextLabel}</span>
      </div>
    </header>
  );
}
