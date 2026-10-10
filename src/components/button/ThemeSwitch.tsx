import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  Button,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  DropdownTrigger,
} from "@/components/ui";
export function ThemeSwitch({
  className,
  isCollapsed,
  onToggle,
}: {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: (theme: string) => void;
  classNames?: Record<string, string>;
}) {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="ghost"
          className={className}
          aria-label="界面主题"
          isIconOnly={isCollapsed}
        >
          <Icon />
          {!isCollapsed && "界面主题"}
        </Button>
      </DropdownTrigger>
      <DropdownMenu>
        {[
          ["system", "跟随系统"],
          ["light", "浅色"],
          ["dark", "深色"],
        ].map(([value, label]) => (
          <DropdownItem
            key={value}
            onPress={() => {
              setTheme(value);
              onToggle?.(value);
            }}
          >
            {label}
            {theme === value ? " ✓" : ""}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
