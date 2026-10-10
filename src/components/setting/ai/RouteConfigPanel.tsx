import type { ReactNode } from "react";

import { Button, Input } from "@/components/ui";
import { Icon } from "@/components/ui/icon";

import { ROUTE_LABEL } from "./aiRoutes";
import { ModelListTable } from "./ModelListTable";
import { TestConnectionBar, type TestResult } from "./TestConnection";
import { FormField, InlineCode } from "../settingPrimitives";

import SearchableSelect from "@/components/SearchableSelect/SearchableSelect.tsx";
import ExternalLink from "@/components/ExternalLink";
import {
  useOpenAIConfigStore,
  type AIRouteType,
} from "@/store/useOpenAIConfigStore";

interface RouteConfigPanelProps {
  routeType: AIRouteType;
  isUtoolsAvailable: boolean;
  testing: boolean;
  testResult: TestResult | null;
  testModelUtools: string;
  testModelSsooai: string;
  testModelCustom: string;
  onSetTestModel: (
    route: "utools" | "ssooai" | "custom",
    value: string,
  ) => void;
  onTest: (routeType: AIRouteType, model?: string) => void;
  onConfigureApiKey: (route: "ssooai" | "custom", apiKey: string) => void;
  onConfigureProxyUrl: (proxyUrl: string) => void;
  onConfigureUtoolsModel: (model: string) => void;
  onRefreshSsooaiModels: () => void;
  onRefreshCustomModels: () => void;
  onRefreshDefaultModels: () => void;
  onClose: () => void;
}

/**
 * 线路配置面板：按 routeType 分发渲染四类配置。
 * 数据从 useOpenAIConfigStore 读取；写操作与测试由 AISettings 下传回调。
 */
export function RouteConfigPanel(props: RouteConfigPanelProps) {
  const { routeType, onClose, testing, testResult, onTest } = props;

  return (
    <div className="space-y-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-lg font-medium">
          <div className="rounded-lg bg-primary/15 p-1.5">
            <Icon icon="solar:settings-bold" width={18} />
          </div>
          {ROUTE_LABEL[routeType]} 配置
        </h3>
        <Button
          isIconOnly
          className="h-8 min-w-8"
          color="default"
          radius="full"
          size="sm"
          variant="flat"
          onPress={onClose}
        >
          <Icon icon="solar:close-circle-bold" width={16} />
        </Button>
      </div>

      {routeType === "default" && (
        <DefaultRouteConfig
          testResult={testResult}
          testing={testing}
          onTest={() => onTest("default")}
          onRefresh={props.onRefreshDefaultModels}
        />
      )}
      {routeType === "ssooai" && <SsooaiRouteConfig {...props} />}
      {routeType === "utools" && props.isUtoolsAvailable && (
        <UtoolsRouteConfig {...props} />
      )}
      {routeType === "custom" && <CustomRouteConfig {...props} />}
    </div>
  );
}

function ConfigSection({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function PromoBanner() {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
      <div className="flex items-center gap-2.5">
        <Icon className="text-primary" icon="solar:star-bold" width={20} />
        <span className="text-[13px] font-medium text-primary">
          SSOOAI API 服务
        </span>
      </div>
      <p className="mt-2 text-xs text-foreground">
        SSOOAI 提供更稳定的 API 服务和多种先进模型。 访问{" "}
        <ExternalLink
          className="font-medium text-primary hover:underline"
          href="https://api.ssooai.com"
        >
          https://api.ssooai.com
        </ExternalLink>{" "}
        注册并获取 API 密钥。
      </p>
    </div>
  );
}

function DefaultRouteConfig({
  onRefresh,
  onTest,
  testing,
  testResult,
}: {
  onTest: () => void;
  onRefresh: () => void;
  testing: boolean;
  testResult: TestResult | null;
}) {
  const { defaultRoute, defaultModels, updateDefaultRouteConfig } =
    useOpenAIConfigStore();

  return (
    <ConfigSection>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Icon className="text-primary" icon="solar:star-bold" width={18} />
        此线路由站点管理员提供。如连接失败，请联系管理员或配置私有API。
      </div>
      <FormField icon="solar:layers-bold" id="site-model" label="模型名称">
        <SearchableSelect
          id="site-model"
          items={defaultModels}
          placeholder="选择 API 返回的模型"
          selectedValue={defaultRoute.model}
          onChange={(model) => updateDefaultRouteConfig({ model })}
        />
      </FormField>
      <TestConnectionBar
        disabled={testing || !defaultRoute.model.trim()}
        result={testResult}
        testing={testing}
        onTest={onTest}
      />
      <ModelListTable models={defaultModels} onRefresh={onRefresh} />
    </ConfigSection>
  );
}

function SsooaiRouteConfig(props: RouteConfigPanelProps) {
  const { ssooaiRoute, ssooaiModels } = useOpenAIConfigStore();
  const {
    testing,
    testResult,
    testModelSsooai,
    onSetTestModel,
    onTest,
    onConfigureApiKey,
    onRefreshSsooaiModels,
  } = props;

  return (
    <ConfigSection>
      <PromoBanner />

      <FormField id="ssooai-api-key" icon="solar:key-bold" label="API 密钥">
        <Input
          className="w-full"
          id="ssooai-api-key"
          placeholder="输入您的 SSOOAI API 密钥"
          size="sm"
          type="password"
          value={ssooaiRoute.apiKey}
          variant="bordered"
          onChange={(e) => onConfigureApiKey("ssooai", e.target.value)}
        />
      </FormField>

      <TestConnectionBar
        disabled={testing || !ssooaiRoute.apiKey || !testModelSsooai}
        result={testResult}
        testing={testing}
        onTest={() => onTest("ssooai", testModelSsooai)}
      >
        <SearchableSelect
          className="w-full sm:w-60"
          items={ssooaiModels}
          placeholder="选择模型"
          selectedValue={testModelSsooai}
          onChange={(value) => onSetTestModel("ssooai", value)}
        />
      </TestConnectionBar>

      <ModelListTable models={ssooaiModels} onRefresh={onRefreshSsooaiModels} />
    </ConfigSection>
  );
}

function UtoolsRouteConfig(props: RouteConfigPanelProps) {
  const { utoolsRoute, utoolsModels } = useOpenAIConfigStore();
  const {
    testing,
    testResult,
    testModelUtools,
    isUtoolsAvailable,
    onSetTestModel,
    onTest,
    onConfigureUtoolsModel,
  } = props;

  return (
    <ConfigSection>
      <FormField id="utools-model" icon="solar:layers-bold" label="选择模型">
        <SearchableSelect
          className="w-full"
          id="utools-model"
          items={utoolsModels}
          placeholder="选择 uTools 模型"
          selectedValue={utoolsRoute.model}
          onChange={(value) => onConfigureUtoolsModel(value)}
        />
      </FormField>

      <TestConnectionBar
        disabled={testing || !isUtoolsAvailable || !testModelUtools}
        result={testResult}
        testing={testing}
        onTest={() => onTest("utools", testModelUtools)}
      >
        <SearchableSelect
          className="w-full sm:w-64"
          items={utoolsModels}
          placeholder="选择模型"
          selectedValue={testModelUtools}
          onChange={(value) => onSetTestModel("utools", value)}
        />
      </TestConnectionBar>

      <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-xs text-foreground">
        <div className="flex items-center gap-2">
          <Icon
            className="text-warning"
            icon="solar:info-circle-bold"
            width={16}
          />
          <span className="font-medium">提示</span>
        </div>
        <p className="ml-6 mt-1">
          Utools 官方线路由 Utools
          团队维护，提供更稳定的服务和更多模型选择，但需要付费使用。
        </p>
      </div>
    </ConfigSection>
  );
}

function CustomRouteConfig(props: RouteConfigPanelProps) {
  const { customRoute, customModels } = useOpenAIConfigStore();
  const {
    testing,
    testResult,
    testModelCustom,
    onSetTestModel,
    onTest,
    onConfigureApiKey,
    onConfigureProxyUrl,
    onRefreshCustomModels,
  } = props;

  return (
    <ConfigSection>
      <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
        <div className="flex items-center gap-2.5">
          <Icon
            className="text-primary"
            icon="solar:bookmark-square-bold"
            width={20}
          />
          <span className="font-medium">SSOOAI API</span>
        </div>
        <p className="mt-2 text-xs text-foreground">
          推荐使用 SSOOAI API 作为私有API，填入 API 地址：
          <InlineCode>https://api.ssooai.com/v1</InlineCode>
          ，注册即可获得免费额度。高稳定性、低延迟、更实惠的价格。
        </p>
      </div>

      <FormField id="api-url" icon="solar:link-bold" label="API 地址">
        <Input
          className="w-full"
          id="api-url"
          placeholder="输入 API 地址，例如: https://api.ssooai.com/v1"
          size="sm"
          value={customRoute.proxyUrl}
          variant="bordered"
          onChange={(e) => onConfigureProxyUrl(e.target.value)}
        />
      </FormField>

      <FormField id="api-key" icon="solar:key-bold" label="API 密钥">
        <Input
          className="w-full"
          id="api-key"
          placeholder="输入您的 API 密钥"
          size="sm"
          type="password"
          value={customRoute.apiKey}
          variant="bordered"
          onChange={(e) => onConfigureApiKey("custom", e.target.value)}
        />
      </FormField>

      <TestConnectionBar
        disabled={
          testing ||
          !customRoute.apiKey ||
          !customRoute.proxyUrl ||
          !testModelCustom
        }
        result={testResult}
        testing={testing}
        onTest={() => onTest("custom", testModelCustom)}
      >
        <SearchableSelect
          className="w-full sm:w-60"
          items={customModels}
          placeholder="选择模型"
          selectedValue={testModelCustom}
          onChange={(value) => onSetTestModel("custom", value)}
        />
      </TestConnectionBar>

      <ModelListTable models={customModels} onRefresh={onRefreshCustomModels} />
    </ConfigSection>
  );
}
