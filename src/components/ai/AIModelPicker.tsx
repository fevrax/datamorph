import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Network,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import {
  type AIRouteType,
  useOpenAIConfigStore,
} from "@/store/useOpenAIConfigStore";
import {
  AI_ROUTE_CONFIG_KEYS,
  AI_ROUTE_LABELS,
  getAIModels,
  getAISelection,
} from "@/services/aiModelSelection";
import "./assistant.css";

export default function AIModelPicker({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const config = useOpenAIConfigStore();
  const [open, setOpen] = useState(false);
  const [browseRoute, setBrowseRoute] = useState<AIRouteType>(config.routeType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const hasUtools = typeof window !== "undefined" && "utools" in window;
  const routes: AIRouteType[] = [
    "default",
    "custom",
    "ssooai",
    ...(hasUtools ? ["utools" as const] : []),
  ];
  const available = (route: AIRouteType) =>
    route === "default" ||
    (config.routeEnabled[route] && (route !== "utools" || hasUtools));
  const selectedModel = config[AI_ROUTE_CONFIG_KEYS[config.routeType]].model;
  const selectedLabel =
    getAIModels(config, config.routeType).find(
      (model) => model.value === selectedModel,
    )?.label || "选择模型";
  const models = getAIModels(config, browseRoute);
  const credentialsMissing =
    (browseRoute === "custom" || browseRoute === "ssooai") &&
    (!config[AI_ROUTE_CONFIG_KEYS[browseRoute]].apiKey ||
      !config[AI_ROUTE_CONFIG_KEYS[browseRoute]].proxyUrl);

  useEffect(() => {
    const state = useOpenAIConfigStore.getState();
    if (
      state.routeType !== "default" &&
      (!state.routeEnabled[state.routeType] ||
        (state.routeType === "utools" && !hasUtools))
    ) {
      state.updateConfig(
        getAISelection(state, "default") || { routeType: "default" },
      );
    }
  }, [config.routeType, config.routeEnabled, hasUtools]);

  useEffect(() => {
    setLoading(false);
    if (disabled) return;
    const route = open ? browseRoute : config.routeType;
    const state = useOpenAIConfigStore.getState();
    if (
      (route === "custom" || route === "ssooai") &&
      (!state[AI_ROUTE_CONFIG_KEYS[route]].apiKey ||
        !state[AI_ROUTE_CONFIG_KEYS[route]].proxyUrl)
    )
      return;
    const list =
      route === "default"
        ? state.defaultModels
        : route === "custom"
          ? state.customModels
          : route === "ssooai"
            ? state.ssooaiModels
            : state.utoolsModels;
    if (list.length && refresh === 0) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const fetchModels = {
      default: state.fetchDefaultModels,
      custom: state.fetchCustomModels,
      ssooai: state.fetchSsooaiModels,
      utools: state.fetchUtoolsModels,
    }[route];
    void fetchModels()
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "模型列表暂不可用，请重试。",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    browseRoute,
    refresh,
    config.routeType,
    disabled,
    config.customRoute.apiKey,
    config.customRoute.proxyUrl,
    config.ssooaiRoute.apiKey,
    config.ssooaiRoute.proxyUrl,
  ]);

  return (
    <Popover
      isOpen={open}
      onOpenChange={(value) => {
        setOpen(value);
        setLoading(false);
        setError("");
        setRefresh(0);
        if (value) setBrowseRoute(config.routeType);
      }}
    >
      <PopoverTrigger>
        <Button
          className="ai-model-trigger"
          variant="ghost"
          isDisabled={disabled}
          aria-label={`选择线路与模型，当前 ${AI_ROUTE_LABELS[config.routeType]} · ${selectedLabel}`}
          title={`${AI_ROUTE_LABELS[config.routeType]} · ${selectedLabel}`}
        >
          <Network className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {AI_ROUTE_LABELS[config.routeType]}
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{selectedLabel}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="ai-surface ai-model-picker-popover"
        aria-label="线路与模型选择器"
        align="end"
        collisionPadding={12}
      >
        <div className="ai-picker-heading">
          <span>线路与模型</span>
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            aria-label="刷新模型列表"
            title="刷新模型列表"
            isDisabled={loading || credentialsMissing}
            onPress={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
        <div className="ai-picker-columns">
          <div className="ai-picker-routes" role="group" aria-label="选择线路">
            {routes.map((route) => (
              <button
                key={route}
                type="button"
                className="ai-picker-route"
                aria-pressed={browseRoute === route}
                disabled={!available(route)}
                onClick={() => {
                  if (route === browseRoute) return;
                  setBrowseRoute(route);
                  setError("");
                  setLoading(false);
                  setRefresh(0);
                }}
              >
                <span>
                  {AI_ROUTE_LABELS[route]}
                  {!available(route) && <small>未启用</small>}
                </span>
                <ChevronRight
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <div
            className="ai-picker-models"
            role="group"
            aria-label={`${AI_ROUTE_LABELS[browseRoute]}模型`}
          >
            <p className="mb-2 px-2 text-[11px] text-muted-foreground">
              {AI_ROUTE_LABELS[browseRoute]}
            </p>
            {loading && (
              <p className="ai-picker-notice" role="status">
                <LoaderCircle className="size-3.5 animate-spin" />
                正在获取模型…
              </p>
            )}
            {credentialsMissing ? (
              <p className="ai-picker-notice">
                请先在 AI 设置中配置接口地址和密钥。
              </p>
            ) : (
              models.map((model, index) => (
                <button
                  type="button"
                  className="ai-picker-model"
                  key={model.value}
                  aria-pressed={
                    config.routeType === browseRoute &&
                    selectedModel === model.value
                  }
                  disabled={loading}
                  title={model.label}
                  onClick={() => {
                    const state = useOpenAIConfigStore.getState();
                    const selection = getAISelection(
                      state,
                      browseRoute,
                      model.value,
                    );
                    if (selection) state.updateConfig(selection);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 break-words">
                    {model.label}
                    {index === 0 && <small>默认模型</small>}
                  </span>
                  {config.routeType === browseRoute &&
                    selectedModel === model.value && (
                      <Check className="size-4 shrink-0" aria-hidden="true" />
                    )}
                </button>
              ))
            )}
            {!models.length && !loading && !credentialsMissing && !error && (
              <p className="ai-picker-notice">
                API 暂未返回模型，请刷新或检查 API 配置。
              </p>
            )}
            {error && (
              <p className="ai-picker-notice" role="status">
                {error}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
