import { VirtualList } from "@/components/ui/virtual-list";
import React, { useState, useMemo, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  Checkbox,
  Button,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";

interface ColumnFilterPopoverProps {
  /** 列名 */
  columnKey: string;
  /** 该列所有去重后的值（预计算） */
  allValues: string[];
  /** 当前选中的值集合 */
  selectedValues: Set<string>;
  /** 是否有活跃筛选（用于图标高亮） */
  isActive: boolean;
  /** 筛选变化回调 */
  onFilterChange: (columnKey: string, selectedValues: Set<string>) => void;
}

/** 去重列表最大显示数量 */

const ColumnFilterPopover: React.FC<ColumnFilterPopoverProps> = ({
  columnKey,
  allValues,
  selectedValues,
  isActive,
  onFilterChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [tempSelected, setTempSelected] = useState<Set<string>>(
    new Set(selectedValues),
  );

  // 打开 Popover 时同步选中状态
  useEffect(() => {
    if (isOpen) {
      setTempSelected(new Set(selectedValues));
      setSearchText("");
    }
  }, [isOpen, selectedValues]);

  // 搜索过滤后的列表
  const filteredValues = useMemo(() => {
    const values = searchText
      ? allValues.filter((v) =>
          v.toLowerCase().includes(searchText.toLowerCase()),
        )
      : allValues;

    return values;
  }, [allValues, searchText]);

  const isAllSelected =
    tempSelected.size === allValues.length && allValues.length > 0;
  const isNoneSelected = tempSelected.size === 0;
  const isIndeterminate = !isAllSelected && !isNoneSelected;

  const handleToggleAll = () => {
    if (isAllSelected) {
      setTempSelected(new Set());
    } else {
      setTempSelected(new Set(allValues));
    }
  };

  const handleToggleItem = (value: string) => {
    setTempSelected((prev) => {
      const next = new Set(prev);

      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }

      return next;
    });
  };

  const handleConfirm = () => {
    onFilterChange(columnKey, tempSelected);
    setIsOpen(false);
  };

  const handleReset = () => {
    setTempSelected(new Set(allValues));
  };

  const totalValues = allValues.length;
  const hiddenCount = searchText
    ? allValues.filter((v) =>
        v.toLowerCase().includes(searchText.toLowerCase()),
      ).length - filteredValues.length
    : totalValues - filteredValues.length;

  return (
    <Popover
      classNames={{
        content: "p-0",
      }}
      isOpen={isOpen}
      placement="bottom"
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger>
        <button
          className={`inline-flex items-center justify-center w-5 h-5 rounded-sm transition-colors ${
            isActive
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-primary hover:bg-secondary"
          }`}
          aria-label={`筛选 ${columnKey}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon
            icon={isActive ? "mdi:filter" : "mdi:filter-outline"}
            width={14}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="w-56 p-2">
          {/* 搜索框 */}
          <Input
            isClearable
            className="mb-2"
            placeholder="搜索..."
            size="sm"
            startContent={
              <Icon
                className="text-muted-foreground"
                icon="mdi:magnify"
                width={16}
              />
            }
            value={searchText}
            onValueChange={setSearchText}
          />

          {/* 全选/取消全选 */}
          <div className="flex items-center gap-2 mb-1 px-1">
            <Checkbox
              isIndeterminate={isIndeterminate}
              isSelected={isAllSelected}
              size="sm"
              onValueChange={handleToggleAll}
            >
              <span className="text-xs text-muted-foreground">
                全选 ({tempSelected.size}/{totalValues})
              </span>
            </Checkbox>
          </div>

          {/* 去重列表 */}
          <div className="max-h-48 overflow-y-auto border-t border-b border-border py-1">
            <VirtualList items={filteredValues}>
              {(value) => (
                <div
                  key={value}
                  className="flex items-center gap-2 px-1 py-0.5 hover:bg-muted rounded-sm"
                >
                  <Checkbox
                    isSelected={tempSelected.has(value)}
                    size="sm"
                    onValueChange={() => handleToggleItem(value)}
                  >
                    <span
                      className="text-xs truncate max-w-[140px]"
                      title={value}
                    >
                      {value || "(空)"}
                    </span>
                  </Checkbox>
                </div>
              )}
            </VirtualList>
            {hiddenCount > 0 && (
              <div className="text-xs text-muted-foreground px-2 py-1">
                还有 {hiddenCount} 项，请搜索缩小范围
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between mt-2">
            <Button
              className="text-xs h-7"
              size="sm"
              variant="light"
              onPress={handleReset}
            >
              重置
            </Button>
            <Button
              className="text-xs h-7"
              color="primary"
              size="sm"
              onPress={handleConfirm}
            >
              确定
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnFilterPopover;
