import type { TestResult } from "../ai/TestConnection";

import { useEffect, useState } from "react";

import {
  GroupLabel,
  InfoNote,
  SectionCard,
  SectionHeader,
} from "../settingPrimitives";
import { RouteCard } from "../ai/RouteCard";
import { RouteConfigPanel } from "../ai/RouteConfigPanel";

import toast from "@/utils/toast";
import ExternalLink from "@/components/ExternalLink";
import {
  useOpenAIConfigStore,
  type AIRouteType,
} from "@/store/useOpenAIConfigStore";
import { OpenAIService, openAIService } from "@/services/openAIService";
import { isUtoolsAvailable } from "@/utils/env";

/**
 * AI 助手设置：线路管理（4 条线路） + 线路配置面板 + 推荐横幅。
 * 模型由各线路 API 提供，不维护本地手动模型列表。
 */
export function AISettings() {
  const {
    routeType,
    ssooaiRoute,
    customRoute,
    ssooaiModels,
    customModels,
    utoolsModels,
    routeEnabled,
    updateConfig,
    updateUtoolsRouteConfig,
    updateSsooaiRouteConfig,
    updateCustomRouteConfig,
    updateRouteEnabled,
    fetchModels,
    syncConfig,
  } = useOpenAIConfigStore();

  const [configuringRoute, setConfiguringRoute] = useState<AIRouteType | null>(
    null,
  );
  const [testingRoute, setTestingRoute] = useState<AIRouteType | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testModelUtools, setTestModelUtools] = useState<string>("");
  const [testModelSsooai, setTestModelSsooai] = useState<string>("");
  const [testModelCustom, setTestModelCustom] = useState<string>("");

  // 初始化时同步配置
  useEffect(() => {
    syncConfig();
  }, [syncConfig]);

  // Only fetch the panel being configured. Debounce credential edits.
  useEffect(() => {
    if (!configuringRoute) return;
    const timer = setTimeout(() => {
      void fetchModels(configuringRoute).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "获取模型失败");
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    configuringRoute,
    fetchModels,
    ssooaiRoute.apiKey,
    ssooaiRoute.proxyUrl,
    customRoute.apiKey,
    customRoute.proxyUrl,
  ]);

  const refreshModels = (route: AIRouteType) => {
    void fetchModels(route).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "获取模型失败");
    });
  };

  // 配置变更同步到 openAIService
  useEffect(() => {
    openAIService.syncConfig();
  }, [routeType]);

  // 默认测试模型
  useEffect(() => {
    if (!utoolsModels.some((model) => model.value === testModelUtools)) {
      setTestModelUtools(utoolsModels[0]?.value || "");
    }
  }, [utoolsModels, testModelUtools]);

  useEffect(() => {
    if (!ssooaiModels.some((model) => model.value === testModelSsooai)) {
      setTestModelSsooai(ssooaiModels[0]?.value || "");
    }
  }, [ssooaiModels, testModelSsooai]);

  useEffect(() => {
    if (!customModels.some((model) => model.value === testModelCustom)) {
      setTestModelCustom(customModels[0]?.value || "");
    }
  }, [customModels, testModelCustom]);

  // 配置线路：切换 routeType 并自动启用
  const handleConfigureRoute = (type: AIRouteType) => {
    setConfiguringRoute(type);
    updateConfig({ routeType: type });
    if (type !== "default") {
      updateRouteEnabled(type, true);
    }
    setTestingRoute(null);
    setTestResult(null);
    openAIService.syncConfig();
  };

  const handleCloseConfig = () => setConfiguringRoute(null);

  // 配置变更处理
  const handleApiKeyChange = (route: "ssooai" | "custom", apiKey: string) => {
    if (route === "ssooai") {
      updateSsooaiRouteConfig({ apiKey });
      if (routeType === "ssooai") openAIService.syncConfig();
    } else {
      updateCustomRouteConfig({ apiKey });
      if (routeType === "custom") openAIService.syncConfig();
    }
  };

  const handleProxyUrlChange = (proxyUrl: string) => {
    updateCustomRouteConfig({ proxyUrl });
    if (routeType === "custom") openAIService.syncConfig();
  };

  const handleUtoolsModelChange = (model: string) => {
    updateUtoolsRouteConfig({ model });
    if (routeType === "utools") openAIService.syncConfig();
  };

  // 测试连接
  const testRouteConnection = async (type: AIRouteType, testModel?: string) => {
    setTestingRoute(type);
    setTestResult(null);
    const testService = OpenAIService.createInstance();

    try {
      let modelToTest: string;

      if (type === "default") {
        modelToTest = useOpenAIConfigStore.getState().defaultRoute.model;
      } else if (testModel) {
        modelToTest = testModel;
      } else {
        throw new Error("请选择要测试的模型");
      }

      testService.updateConfig({ routeType: type, model: modelToTest });
      const response = await testService.chat({
        messages: [{ role: "user", content: "say 1" }],
        model: modelToTest,
      });

      if (response?.choices?.[0]?.message) {
        setTestResult({ success: true, message: "连接成功，线路畅通！" });
      } else {
        throw new Error("API 返回结果异常");
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "未知错误，连接失败",
      });
    } finally {
      setTestingRoute(null);
    }
  };

  return (
    <div className="h-full">
      <SectionHeader description="管理 AI 线路与模型配置" title="AI 设置" />

      <GroupLabel>AI 线路</GroupLabel>
      <p className="mb-3 px-4 text-[13px] text-muted-foreground">
        启用或禁用不同的 AI
        线路，点击「配置」按钮设置线路参数。站点线路需要由站点管理员启用。
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RouteCard
          isSelected
          showConfigure
          description="使用站点提供的 AI 服务；不可用时可配置私有API"
          routeType="default"
          onConfigure={() => handleConfigureRoute("default")}
          onToggle={() => {}}
        />
        <RouteCard
          available
          showConfigure
          description="高性能服务，支持多种高级模型"
          isSelected={routeEnabled.ssooai}
          routeType="ssooai"
          onConfigure={() => handleConfigureRoute("ssooai")}
          onToggle={(enabled) => updateRouteEnabled("ssooai", enabled)}
        />
        <RouteCard
          available={isUtoolsAvailable}
          description="uTools 官方的 AI 智能助手"
          isSelected={routeEnabled.utools}
          routeType="utools"
          onToggle={(enabled) => updateRouteEnabled("utools", enabled)}
        />
        <RouteCard
          available
          showConfigure
          description="自定义 API 连接，支持各类模型"
          isSelected={routeEnabled.custom}
          routeType="custom"
          onConfigure={() => handleConfigureRoute("custom")}
          onToggle={(enabled) => updateRouteEnabled("custom", enabled)}
        />
      </div>

      {/* 推荐横幅 */}
      <InfoNote className="mx-0 mt-5 sm:mx-0" title="推荐使用 SSOOAI API">
        <p>
          <ExternalLink
            className="font-medium text-primary hover:underline"
            href="https://api.ssooai.com"
          >
            SSOOAI
          </ExternalLink>{" "}
          提供稳定、高效且价格实惠的 API 服务，支持 ChatGPT、DeepSeek、Claude 4
          等先进模型。新用户可享受充值优惠。
        </p>
      </InfoNote>

      {/* 线路配置面板 */}
      {configuringRoute ? <GroupLabel>线路配置</GroupLabel> : null}
      {configuringRoute ? (
        <SectionCard className="p-4 sm:p-5">
          <RouteConfigPanel
            isUtoolsAvailable={isUtoolsAvailable}
            routeType={configuringRoute}
            testModelCustom={testModelCustom}
            testModelSsooai={testModelSsooai}
            testModelUtools={testModelUtools}
            testResult={testResult}
            testing={testingRoute === configuringRoute}
            onClose={handleCloseConfig}
            onConfigureApiKey={handleApiKeyChange}
            onConfigureProxyUrl={handleProxyUrlChange}
            onConfigureUtoolsModel={handleUtoolsModelChange}
            onRefreshCustomModels={() => refreshModels("custom")}
            onRefreshSsooaiModels={() => refreshModels("ssooai")}
            onRefreshDefaultModels={() => refreshModels("default")}
            onSetTestModel={(route, value) => {
              if (route === "utools") setTestModelUtools(value);
              else if (route === "ssooai") setTestModelSsooai(value);
              else setTestModelCustom(value);
            }}
            onTest={testRouteConnection}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
