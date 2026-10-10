// src/pages/ToolboxPage.tsx
import React from "react";
import { Icon } from "@/components/ui/icon";
import { Chip } from "@/components/ui";
import { Button } from "@/components/ui";

import { SearchBox } from "@/components/toolbox/SearchBox.tsx";
import { ToolCard } from "@/components/toolbox/ToolCard.tsx";
import { useToolboxStore } from "@/store/useToolboxStore";

const ToolboxPage: React.FC = () => {
  const { filteredTools } = useToolboxStore();
  const tools = filteredTools();

  const toolboxStore = useToolboxStore();

  // 获取所有唯一分类
  const categories = Array.from(
    new Set(tools.flatMap((tool) => tool.category || []).filter(Boolean)),
  );

  // 空结果状态
  const NoResults = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <Icon
        className="text-input mb-4"
        icon="solar:empty-file-outline"
        width={64}
      />
      <h3 className="text-xl font-semibold">没有找到匹配的工具</h3>
      <p className="text-muted-foreground mt-2 max-w-md">
        尝试使用不同的关键词或浏览下方的所有工具分类
      </p>
    </div>
  );

  return (
    <div className="bg-muted w-full h-full overflow-auto">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
          <div>
            <h1 className="text-lg font-semibold flex items-center">
              <Icon
                className="mr-2 text-primary"
                icon="solar:toolbox-bold"
                width={22}
              />
              工具箱
            </h1>
          </div>
          <SearchBox />
        </div>

        {/* 分类筛选器 */}
        {categories.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="text-muted-foreground flex items-center mr-1 text-sm">
              <Icon className="mr-1" icon="solar:tag-outline" width={16} />
              分类:
            </span>
            {categories.map((category) => (
              <Chip
                key={category}
                className="cursor-pointer"
                color="primary"
                variant="flat"
                onClick={() => toolboxStore.setSearchQuery(category as string)}
              >
                {category}
              </Chip>
            ))}
            {toolboxStore.searchQuery && (
              <Button
                size="sm"
                variant="light"
                onPress={() => toolboxStore.setSearchQuery("")}
              >
                清除筛选
              </Button>
            )}
          </div>
        )}

        {/* 工具卡片网格 */}
        {tools.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 pb-4">
            {tools.map((tool) => (
              <div key={tool.id}>
                <div>
                  <ToolCard tool={tool} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <NoResults />
        )}
      </div>
    </div>
  );
};

export default ToolboxPage;
