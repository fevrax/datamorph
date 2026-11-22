import { t } from "@/i18n";
import { useLocale } from "@/i18n/useLocale";
import { DropdownMenu } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";

const OPTIONS = [
  {
    value: "auto",
    get label() {
      return t("自动");
    },
  },
  ...Array.from({ length: 10 }, (_, index) => ({
    value: String(index + 1),
    get label() {
      return t("{0} 空格", { 0: index + 1 });
    },
  })),
];

interface IndentationSelectorProps {
  indentMode: "auto" | "manual";
  indentSize: number;
  insertSpaces: boolean;
  onModeChange: (mode: "auto" | "manual") => void;
  onSizeChange: (size: number) => void;
}

export default function IndentationSelector({
  indentMode,
  indentSize,
  insertSpaces,
  onModeChange,
  onSizeChange,
}: IndentationSelectorProps) {
  useLocale();
  const size = insertSpaces
    ? t("{0} 空格", { 0: indentSize })
    : t("Tab · 宽度 {0}", { 0: indentSize });
  const label = indentMode === "auto" ? t("自动 · {0}", { 0: size }) : size;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("选择缩进")}
          title={t("选择缩进 · {0}", { 0: label })}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          {label}
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={t("缩进")}
          side="top"
          align="end"
          sideOffset={5}
          collisionPadding={8}
          className="z-[120] w-36 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{
            maxHeight:
              "min(360px, var(--radix-dropdown-menu-content-available-height))",
          }}
        >
          <DropdownMenu.RadioGroup
            value={
              indentMode === "auto"
                ? "auto"
                : insertSpaces
                  ? String(indentSize)
                  : ""
            }
            onValueChange={(value) =>
              value === "auto"
                ? onModeChange("auto")
                : onSizeChange(Number(value))
            }
          >
            {OPTIONS.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="relative flex cursor-default items-center rounded-md py-1.5 pl-7 pr-2 text-[13px] outline-none focus:bg-accent"
              >
                <DropdownMenu.ItemIndicator className="absolute left-2">
                  <Check className="size-3.5" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
