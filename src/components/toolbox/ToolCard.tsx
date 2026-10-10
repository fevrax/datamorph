import type { Tool } from "@/store/useToolboxStore.ts";

import React from "react";
import { Card, CardBody, CardFooter } from "@/components/ui";
import { Chip } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

import { useTabStore } from "@/store/useTabStore";

interface ToolCardProps {
  tool: Tool;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const addToolTab = useTabStore((state) => state.addToolTab);

  const handleCardClick = () => {
    addToolTab(tool);
  };

  return (
    <Card
      isPressable
      className="w-full h-[144px] cursor-pointer rounded-lg transition-shadow duration-200 hover:shadow-md flex flex-col"
      onPress={handleCardClick}
    >
      <CardBody className="overflow-hidden p-3 flex-grow bg-secondary/30">
        <div className="flex items-start gap-3 mb-2">
          <div className="p-2 rounded-lg bg-secondary flex-none">
            <Icon
              className="text-primary"
              height={22}
              icon={tool.icon}
              width={22}
            />
          </div>
          <div className="overflow-hidden min-w-0">
            <h3 className="text-sm font-semibold truncate">{tool.name}</h3>
            <div className="flex flex-wrap gap-1 mt-1 max-h-6 overflow-hidden">
              {tool.category.length > 0 &&
                tool.category.map((category: string) => (
                  <Chip
                    key={category}
                    className="max-w-[96px] h-5"
                    color="primary"
                    size="sm"
                    variant="flat"
                  >
                    <span className="truncate">{category}</span>
                  </Chip>
                ))}
            </div>
          </div>
        </div>
        <p className="text-muted-foreground text-xs leading-5 line-clamp-2">
          {tool.description}
        </p>
      </CardBody>
      <CardFooter className="bg-secondary/30 border-t-1 border-secondary justify-end gap-2 flex-none px-3 py-2">
        <div className="flex items-center text-primary text-xs">
          <span>新建工具 Tab</span>
          <Icon className="ml-1" icon="solar:arrow-right-linear" width={16} />
        </div>
      </CardFooter>
    </Card>
  );
};
