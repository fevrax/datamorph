import React from "react";
import { Button, ButtonGroup } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

interface JsonPathBarProps {
  currentPath: string;
  onExpand: () => void;
  onCollapse: () => void;
}

const JsonPathBar: React.FC<JsonPathBarProps> = ({
  currentPath,
  onExpand,
  onCollapse,
}) => {
  return (
    <div className="h-8 flex items-center justify-between px-2 bg-muted border-b border-border">
      {/* 当前JSON路径 */}
      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
        <Icon icon="solar:folder-path-duotone" width={16} />
        <span>{currentPath}</span>
      </div>

      {/* 展开/折叠按钮组 */}
      <ButtonGroup size="sm" variant="light">
        <Button
          className="text-sm text-muted-foreground"
          startContent={<Icon icon="tabler:fold-down" width={16} />}
          onPress={onExpand}
        >
          展开所有
        </Button>
        <Button
          className="text-sm text-muted-foreground"
          startContent={<Icon icon="tabler:fold-up" width={16} />}
          onPress={onCollapse}
        >
          折叠所有
        </Button>
      </ButtonGroup>
    </div>
  );
};

export default JsonPathBar;
