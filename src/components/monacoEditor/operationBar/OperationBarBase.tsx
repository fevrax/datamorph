import React, { useEffect, useState } from "react";
import {
  Button,
  cn,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";

import { DEFAULT_DROPDOWN_TIMEOUT } from "./useDropdownTimeout";

// 定义基础按钮接口
export interface BaseButtonConfig {
  key: string;
  icon: string;
  text: string;
  tooltip: string;
  onClick: () => void;
  iconColor?: string;
  className?: string;
  priority?: number; // 按钮显示优先级，数字越小优先级越高
}

// 定义状态按钮接口
export interface StatusButtonConfig extends BaseButtonConfig {
  isStatusButton: true;
  status: IconStatus;
  successText?: string;
}

// 定义下拉菜单按钮接口
export interface DropdownButtonConfig extends BaseButtonConfig {
  hasDropdown: true;
  dropdownItems: {
    key: string;
    icon: string;
    text: string;
    onClick: () => void;
  }[];
}

// 按钮类型
export type ButtonConfig =
  | BaseButtonConfig
  | StatusButtonConfig
  | DropdownButtonConfig;

// 按钮组接口
export interface ButtonGroup {
  key: string;
  buttons: ButtonConfig[];
}

// 下拉菜单状态枚举
export enum IconStatus {
  Default = "default",
  Success = "success",
  Error = "error",
}

// 常量
export const MORE_BUTTON_WIDTH = 70;
export const SEPARATOR_WIDTH = 20;
export const MIN_PADDING = 12;
export { DEFAULT_DROPDOWN_TIMEOUT };

// 自适应按钮显示计算逻辑
export const useAdaptiveButtons = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  actionGroups: ButtonGroup[],
) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const resize = () => setWidth(element.clientWidth);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);
  const buttons = actionGroups
    .flatMap((group) => group.buttons)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  let available = width - 2 * MIN_PADDING - 2 * SEPARATOR_WIDTH;
  if (buttons.length * 75 > available) available -= MORE_BUTTON_WIDTH;
  const count = Math.max(0, Math.floor(available / 75));
  return {
    visibleButtons: buttons.slice(0, count).map((button) => button.key),
    hiddenButtons: buttons.slice(count),
  };
};

// 渲染标准按钮
export const renderStandardButton = (button: BaseButtonConfig) => {
  return (
    <Tooltip key={button.key} content={button.tooltip} delay={300}>
      <Button
        className={cn(
          "pl-1.5 pr-1.5 h-7 gap-1 text-muted-foreground transition-colors text-xs",
          button.className,
          "hover:bg-border/50",
        )}
        size="sm"
        startContent={
          <Icon
            className={button.iconColor || ""}
            icon={button.icon}
            width={16}
          />
        }
        variant="light"
        onPress={button.onClick}
      >
        {button.text}
      </Button>
    </Tooltip>
  );
};

// 渲染下拉菜单
export const renderDropdownButton = (
  button: DropdownButtonConfig,
  isDropdownOpen: boolean,
  setDropdownOpen: React.Dispatch<React.SetStateAction<boolean>> | undefined,
  showDropdown?: () => void,
  unShowDropdown?: () => void,
  clearDropdownTimeout?: (key: string) => void,
) => {
  return (
    <Dropdown
      key={button.key}
      classNames={{
        content: "min-w-[140px] p-1",
      }}
      isOpen={isDropdownOpen}
      placement="bottom"
      radius="sm"
      onOpenChange={setDropdownOpen}
    >
      <DropdownTrigger
        onMouseEnter={showDropdown}
        onMouseLeave={unShowDropdown}
      >
        <Button
          className={cn(
            "pl-1.5 pr-1.5 h-7 gap-1 text-muted-foreground transition-colors text-xs",
            button.className,
            "hover:bg-border/50",
          )}
          size="sm"
          startContent={
            <Icon
              className={button.iconColor || ""}
              icon={button.icon}
              width={16}
            />
          }
          variant="light"
        >
          {button.text}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={`${button.text} options`}
        onMouseEnter={() =>
          clearDropdownTimeout && clearDropdownTimeout(button.key)
        }
        onMouseLeave={unShowDropdown}
      >
        {button.dropdownItems.map((item) => (
          <DropdownItem
            key={item.key}
            className="py-2 px-3 hover:bg-secondary rounded-md"
            textValue={item.text}
            onPress={item.onClick}
          >
            <div className="flex items-center space-x-2">
              <Icon icon={item.icon} width={16} />
              <span>{item.text}</span>
            </div>
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

// 渲染更多菜单
export const renderMoreMenu = (
  hiddenButtons: ButtonConfig[],
  isMoreDropdownOpen: boolean,
  setMoreDropdownOpen:
    | React.Dispatch<React.SetStateAction<boolean>>
    | undefined,
  showMoreDropdown?: () => void,
  unShowMoreDropdown?: () => void,
  clearMoreDropdownTimeout?: () => void,
) => {
  // 如果没有隐藏的按钮，不显示更多菜单
  if (hiddenButtons.length === 0) return null;

  return (
    <Dropdown
      classNames={{
        base: "before:bg-border",
        content: "min-w-[140px] p-1",
      }}
      isOpen={isMoreDropdownOpen}
      placement="bottom"
      radius="sm"
      onOpenChange={setMoreDropdownOpen}
    >
      <DropdownTrigger
        onMouseEnter={showMoreDropdown}
        onMouseLeave={unShowMoreDropdown}
      >
        <Button
          className="pl-1.5 pr-1.5 h-7 gap-1 text-muted-foreground !min-w-14 hover:bg-border/50 transition-colors text-xs"
          startContent={<Icon icon="mingcute:more-2-fill" width={16} />}
          variant="light"
        >
          更多
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="更多操作"
        onMouseEnter={() =>
          clearMoreDropdownTimeout && clearMoreDropdownTimeout()
        }
        onMouseLeave={unShowMoreDropdown}
      >
        {hiddenButtons.flatMap((button) => {
          if ("hasDropdown" in button && button.hasDropdown) {
            // 处理带下拉的按钮，返回所有下拉项目的数组
            return button.dropdownItems.map((item) => (
              <DropdownItem
                key={`${button.key}-${item.key}`}
                className="py-2 px-3 hover:bg-secondary rounded-md"
                textValue={`${button.text} - ${item.text}`}
                onPress={item.onClick}
              >
                <div className="flex items-center space-x-2">
                  <Icon icon={item.icon} width={16} />
                  <span>{`${button.text} - ${item.text}`}</span>
                </div>
              </DropdownItem>
            ));
          } else {
            // 处理普通按钮，返回单个按钮的数组
            return [
              <DropdownItem
                key={button.key}
                className="py-2 px-3 hover:bg-secondary rounded-md"
                textValue={"text" in button ? button.text : ""}
                onPress={button.onClick}
              >
                <div className="flex items-center space-x-2">
                  <Icon icon={"icon" in button ? button.icon : ""} width={16} />
                  <span>{"text" in button ? button.text : ""}</span>
                </div>
              </DropdownItem>,
            ];
          }
        })}
      </DropdownMenu>
    </Dropdown>
  );
};
