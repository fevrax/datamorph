import { useRef } from "react";
import { Braces, FlaskConical, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui";
import { importFiles } from "@/components/dynamicTabs/DynamicTabs";
import { DATA_FILE_ACCEPT } from "@/utils/dataFormats";

export function WorkspaceWelcome({ onSample }: { onSample: () => void }) {
  const file = useRef<HTMLInputElement>(null);

  return (
    <section
      aria-label="开始编辑文档"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="rounded-xl bg-accent p-3 text-primary">
        <Braces className="size-5" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">粘贴或输入数据</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          自动识别格式，也可以将文件拖到这里。
        </p>
      </div>
      <div className="pointer-events-auto flex flex-wrap justify-center gap-1">
        <Button size="sm" variant="ghost" onPress={() => file.current?.click()}>
          <FolderOpen aria-hidden="true" />
          打开文件
        </Button>
        <Button size="sm" variant="ghost" onPress={onSample}>
          <FlaskConical aria-hidden="true" />
          载入示例
        </Button>
      </div>
      <input
        ref={file}
        type="file"
        multiple
        accept={DATA_FILE_ACCEPT}
        hidden
        onChange={(event) => {
          void importFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
