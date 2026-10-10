import type React from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Select,
  SelectItem,
  Slider,
  Switch,
} from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
export const SUPPORTED_LANGUAGES = [
  { id: "json", name: "JSON", icon: "vscode-icons:file-type-json" },
  { id: "json5", name: "JSON5", icon: "vscode-icons:file-type-json" },
  { id: "yaml", name: "YAML", icon: "vscode-icons:file-type-yaml" },
  { id: "xml", name: "XML", icon: "vscode-icons:file-type-xml" },
  { id: "toml", name: "TOML", icon: "vscode-icons:file-type-toml" },
  { id: "go", name: "Go", icon: "vscode-icons:file-type-go" },
  {
    id: "javascript",
    name: "JavaScript",
    icon: "vscode-icons:file-type-js-official",
  },
  {
    id: "typescript",
    name: "TypeScript",
    icon: "vscode-icons:file-type-typescript-official",
  },
  { id: "html", name: "HTML", icon: "vscode-icons:file-type-html" },
  { id: "css", name: "CSS", icon: "vscode-icons:file-type-css" },
  { id: "python", name: "Python", icon: "vscode-icons:file-type-python" },
  { id: "java", name: "Java", icon: "vscode-icons:file-type-java" },
  { id: "csharp", name: "C#", icon: "vscode-icons:file-type-csharp" },
  { id: "cpp", name: "C++", icon: "vscode-icons:file-type-cpp" },
  { id: "markdown", name: "Markdown", icon: "vscode-icons:file-type-markdown" },
  { id: "sql", name: "SQL", icon: "vscode-icons:file-type-sql" },
  { id: "shell", name: "Shell", icon: "vscode-icons:file-type-shell" },
];
interface DraggableMenuProps {
  toolbarTarget?: HTMLElement | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onLanguageChange: (language: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onIndentSizeChange: (indentSize: number) => void;
  onReset: () => void;
  currentLanguage: string;
  currentFontSize: number;
  currentIndentSize: number;
  tabKey: string;
  timestampDecoratorsEnabled?: boolean; // 添加时间戳装饰器状态
  onTimestampDecoratorsChange?: (enabled: boolean) => void; // 添加时间戳装饰器状态变更函数
  base64DecoratorsEnabled?: boolean; // 添加Base64装饰器状态
  unicodeDecoratorsEnabled?: boolean; // 添加Unicode装饰器状态
  urlDecoratorsEnabled?: boolean; // 添加URL装饰器状态
  imageDecoratorsEnabled?: boolean; // 添加图片装饰器状态
  onBase64DecoratorsChange?: (enabled: boolean) => void; // 添加Base64装饰器状态变更函数
  onUnicodeDecoratorsChange?: (enabled: boolean) => void; // 添加Unicode装饰器状态变更函数
  onUrlDecoratorsChange?: (enabled: boolean) => void; // 添加URL装饰器状态变更函数
  onImageDecoratorsChange?: (enabled: boolean) => void; // 添加图片装饰器状态变更函数
}
export default function DraggableMenu(props: DraggableMenuProps) {
  const settings = useSettingsStore();
  const menu = (
    <div
      className={
        props.toolbarTarget ? "flex shrink-0" : "absolute right-3 top-2 z-20"
      }
    >
      <Popover>
        <PopoverTrigger>
          <Button
            aria-label="编辑器设置"
            variant="ghost"
            size="sm"
            isIconOnly
            className={
              props.toolbarTarget
                ? "text-muted-foreground"
                : "border bg-background/95 text-muted-foreground"
            }
          >
            <Settings2 />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-4">
          <h3 className="text-sm font-semibold">编辑器设置</h3>
          <Select
            label="语言"
            selectedKeys={[props.currentLanguage]}
            onChange={(e) => props.onLanguageChange(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <SelectItem key={language.id}>{language.name}</SelectItem>
            ))}
          </Select>
          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span>字体大小</span>
              <span>{props.currentFontSize}px</span>
            </div>
            <Slider
              aria-label="字体大小"
              minValue={12}
              maxValue={24}
              value={props.currentFontSize}
              onChange={(v) => props.onFontSizeChange(Number(v))}
            />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span>缩进</span>
              <span>{props.currentIndentSize} 空格</span>
            </div>
            <Slider
              aria-label="缩进"
              minValue={1}
              maxValue={8}
              value={props.currentIndentSize}
              onChange={(v) => props.onIndentSizeChange(Number(v))}
            />
          </div>
          <div className="space-y-3 border-t pt-3">
            <Switch
              isSelected={
                settings.timestampDecoderEnabled &&
                (props.timestampDecoratorsEnabled ?? true)
              }
              isDisabled={!settings.timestampDecoderEnabled}
              onValueChange={props.onTimestampDecoratorsChange}
            >
              时间戳提示
            </Switch>
            <Switch
              isSelected={settings.base64DecoderEnabled}
              onValueChange={settings.setBase64DecoderEnabled}
            >
              Base64 解码
            </Switch>
            <Switch
              isSelected={settings.unicodeDecoderEnabled}
              onValueChange={settings.setUnicodeDecoderEnabled}
            >
              Unicode 解码
            </Switch>
            <Switch
              isSelected={settings.urlDecoderEnabled}
              onValueChange={settings.setUrlDecoderEnabled}
            >
              URL 解码
            </Switch>
            <Switch
              isSelected={
                settings.imageDecoderEnabled &&
                (props.imageDecoratorsEnabled ?? true)
              }
              onValueChange={(value) => {
                settings.setImageDecoderEnabled(value);
                props.onImageDecoratorsChange?.(value);
              }}
            >
              图片预览
            </Switch>
          </div>
          <Button variant="ghost" className="w-full" onPress={props.onReset}>
            恢复默认设置
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
  return props.toolbarTarget ? createPortal(menu, props.toolbarTarget) : menu;
}
