import { DropdownMenu } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { DATA_FORMATS, type LanguageMode } from "@/utils/dataFormats";

const SUPPORTED_LANGUAGES = [
  ...DATA_FORMATS.map(({ id, name }) => ({ id, name })),
  { id: "go", name: "Go" },
  { id: "python", name: "Python" },
  { id: "java", name: "Java" },
  { id: "csharp", name: "C#" },
  { id: "cpp", name: "C++" },
  { id: "shell", name: "Shell" },
];

interface LanguageSelectorProps {
  language: string;
  languageMode: LanguageMode;
  onLanguageChange: (language: string) => void;
}

export default function LanguageSelector({
  language,
  languageMode,
  onLanguageChange,
}: LanguageSelectorProps) {
  const name =
    SUPPORTED_LANGUAGES.find((item) => item.id === language)?.name ||
    language.toUpperCase();
  const label = languageMode === "auto" ? `自动 · ${name}` : name;
  const options = [{ id: "auto", name: "自动识别" }, ...SUPPORTED_LANGUAGES];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="选择语言"
          title={`选择语言 · ${label}`}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          {label}
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label="语言"
          side="top"
          align="end"
          sideOffset={5}
          collisionPadding={8}
          className="z-[120] w-44 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{
            maxHeight:
              "min(360px, var(--radix-dropdown-menu-content-available-height))",
          }}
        >
          <DropdownMenu.RadioGroup
            value={languageMode === "auto" ? "auto" : language}
            onValueChange={onLanguageChange}
          >
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.id}
                value={option.id}
                className="relative flex cursor-default items-center rounded-md py-1.5 pl-7 pr-2 text-[13px] outline-none focus:bg-accent"
              >
                <DropdownMenu.ItemIndicator className="absolute left-2">
                  <Check className="size-3.5" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
                {option.name}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
