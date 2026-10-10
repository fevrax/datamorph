import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

interface ModelListTableProps {
  models: Array<{ value: string; label: string }>;
  onRefresh: () => void;
}

/** Models are supplied exclusively by the provider API. */
export function ModelListTable({ models, onRefresh }: ModelListTableProps) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">API 模型列表</h4>
        <Button
          size="sm"
          variant="flat"
          onPress={onRefresh}
          startContent={<Icon icon="solar:refresh-bold" width={16} />}
        >
          刷新模型
        </Button>
      </div>
      <div className="max-h-96 overflow-auto rounded-lg border border-border bg-background">
        {models.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            暂无模型，请刷新或检查 API 配置
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {models.map((model) => (
              <li key={model.value} className="break-words px-4 py-3 text-sm">
                {model.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
