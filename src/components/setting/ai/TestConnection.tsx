import { Button } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

export interface TestResult {
  success: boolean;
  message: string;
}

interface TestConnectionBarProps {
  testing: boolean;
  disabled: boolean;
  result?: TestResult | null;
  onTest: () => void;
  /** 右侧可选的测试模型选择器 */
  children?: React.ReactNode;
}

/**
 * AI 线路配置底部的「测试连接」操作栏 + 结果展示。
 */
export function TestConnectionBar({
  testing,
  disabled,
  result,
  onTest,
  children,
}: TestConnectionBarProps) {
  return (
    <>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {children ? (
          <div className="min-w-0 flex-1 sm:flex-none">{children}</div>
        ) : null}
        <Button
          className="w-full sm:w-auto"
          color="primary"
          isDisabled={disabled}
          isLoading={testing}
          radius="full"
          size="sm"
          startContent={
            !testing ? <Icon icon="solar:test-tube-bold" /> : undefined
          }
          variant="flat"
          onPress={onTest}
        >
          测试连接
        </Button>
      </div>

      {testing || result ? <TestResultView result={result} /> : null}
    </>
  );
}

export function TestResultView({ result }: { result?: TestResult | null }) {
  if (!result) return null;

  return (
    <div
      className={`mt-3 rounded-lg border p-3 text-sm ${
        result.success
          ? "border-success/20 bg-success/15 text-success"
          : "border-danger/20 bg-danger/15 text-danger"
      } shadow-sm`}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          icon={
            result.success
              ? "solar:check-circle-bold"
              : "solar:close-circle-bold"
          }
          width={18}
        />
        <span className="font-medium">{result.message}</span>
      </div>
    </div>
  );
}
