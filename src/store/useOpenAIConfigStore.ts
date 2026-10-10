import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import {
  AI_ROUTE_CONFIG_KEYS,
  AI_ROUTE_MODEL_KEYS,
  getAIModels,
} from "../services/aiModelSelection";

import { storage } from "@/lib/indexedDBStore";

// 检查 utools 是否可用
const isUtoolsAvailable = typeof window !== "undefined" && "utools" in window;

// AI 路由类型
export type AIRouteType = "default" | "utools" | "ssooai" | "custom";

// 默认线路配置
interface DefaultRouteConfig {
  model: string;
  temperature: number;
}

// Utools线路配置
interface UtoolsRouteConfig {
  model: string;
  temperature: number;
}

// SSOOAI线路配置
interface SsooaiRouteConfig {
  model: string;
  apiKey: string;
  proxyUrl: string;
  temperature: number;
}

// 自定义线路配置
interface CustomRouteConfig {
  apiKey: string;
  model: string;
  proxyUrl: string;
  temperature: number;
}

// OpenAI 客户端配置接口
export interface OpenAIConfig {
  routeType: AIRouteType;
  defaultRoute: DefaultRouteConfig;
  utoolsRoute: UtoolsRouteConfig;
  ssooaiRoute: SsooaiRouteConfig;
  customRoute: CustomRouteConfig;
  defaultModels: Array<{ value: string; label: string }>;
  utoolsModels: Array<{ value: string; label: string }>;
  ssooaiModels: Array<{ value: string; label: string }>;
  customModels: Array<{ value: string; label: string }>;
  // 线路启用状态
  routeEnabled: {
    default: boolean; // 站点线路由部署者在服务端配置
    utools: boolean;
    ssooai: boolean;
    custom: boolean;
  };
}
const defaultOpenAIConfig: OpenAIConfig = {
  routeType: "default",
  defaultRoute: {
    model: "",
    temperature: 0.7,
  },
  utoolsRoute: {
    model: "",
    temperature: 0.7,
  },
  ssooaiRoute: {
    apiKey: "",
    model: "",
    proxyUrl: "https://api.ssooai.com/v1",
    temperature: 0.7,
  },
  customRoute: {
    apiKey: "",
    model: "",
    proxyUrl: "https://api.ssooai.com/v1",
    temperature: 0.7,
  },
  defaultModels: [],
  utoolsModels: [],
  ssooaiModels: [],
  customModels: [],
  routeEnabled: {
    default: true,
    utools: true, // uTools线路默认启用
    ssooai: false,
    custom: false,
  },
};

// 默认线路只访问同源服务端代理。共享密钥不得写入前端或 VITE_* 环境变量。
export const DEFAULT_ROUTE_PROXY_URL = "/api/ai/v1";

const BD_OPENAI_CONFIG_KEY = "openai-config";

interface OpenAIConfigStore extends OpenAIConfig {
  updateConfig: (config: Partial<OpenAIConfig>) => void;
  updateDefaultRouteConfig: (config: Partial<DefaultRouteConfig>) => void;
  updateUtoolsRouteConfig: (config: Partial<UtoolsRouteConfig>) => void;
  updateSsooaiRouteConfig: (config: Partial<SsooaiRouteConfig>) => void;
  updateCustomRouteConfig: (config: Partial<CustomRouteConfig>) => void;
  updateRouteEnabled: (routeType: AIRouteType, enabled: boolean) => void;
  resetConfig: () => void;
  syncConfig: () => Promise<void>;
  fetchDefaultModels: () => Promise<void>;
  fetchUtoolsModels: () => Promise<void>;
  fetchSsooaiModels: () => Promise<void>;
  fetchCustomModels: () => Promise<void>;
  fetchModels: (route: AIRouteType) => Promise<void>;

  // 获取当前线路的配置
  getCurrentRouteConfig: () =>
    | DefaultRouteConfig
    | UtoolsRouteConfig
    | SsooaiRouteConfig
    | CustomRouteConfig;

  // 获取当前线路的有效 API Key
  getCurrentApiKey: () => string;

  // 获取当前线路的有效 API 地址
  getCurrentProxyUrl: () => string;

  // 获取当前线路的有效模型
  getCurrentModel: () => string;
}

export const useOpenAIConfigStore = create<OpenAIConfigStore>()(
  subscribeWithSelector(
    devtools(
      (set, get) => {
        const modelRequests = { default: 0, utools: 0, ssooai: 0, custom: 0 };
        // 辅助函数：获取可序列化状态
        const getSerializableState = () => {
          const state = get();

          return {
            routeType: state.routeType,
            defaultRoute: state.defaultRoute,
            utoolsRoute: state.utoolsRoute,
            ssooaiRoute: state.ssooaiRoute,
            customRoute: state.customRoute,
            routeEnabled: state.routeEnabled,
          };
        };

        return {
          ...defaultOpenAIConfig,

          updateConfig: (config) => {
            set((state) => ({ ...state, ...config }));
            // 保存到存储，只保存可序列化的数据
            storage
              .setItem(BD_OPENAI_CONFIG_KEY, getSerializableState())
              .catch((err) => console.error("Failed to save config:", err));
          },

          updateDefaultRouteConfig: (config) => {
            set((state) => ({
              ...state,
              defaultRoute: { ...state.defaultRoute, ...config },
            }));
            // 保存到存储，只保存可序列化的数据
            storage
              .setItem(BD_OPENAI_CONFIG_KEY, getSerializableState())
              .catch((err) =>
                console.error("Failed to save default route config:", err),
              );
          },

          updateUtoolsRouteConfig: (config) => {
            set((state) => ({
              ...state,
              utoolsRoute: { ...state.utoolsRoute, ...config },
            }));
            // 保存到存储，只保存可序列化的数据
            storage
              .setItem(BD_OPENAI_CONFIG_KEY, getSerializableState())
              .catch((err) =>
                console.error("Failed to save utools route config:", err),
              );
          },

          updateSsooaiRouteConfig: (config) => {
            set((state) => ({
              ...state,
              ssooaiRoute: { ...state.ssooaiRoute, ...config },
              ...((config.apiKey !== undefined &&
                config.apiKey !== state.ssooaiRoute.apiKey) ||
              (config.proxyUrl !== undefined &&
                config.proxyUrl !== state.ssooaiRoute.proxyUrl)
                ? {
                    ssooaiModels: [],
                    ssooaiRoute: { ...state.ssooaiRoute, ...config, model: "" },
                  }
                : {}),
            }));
            // 保存到存储，只保存可序列化的数据
            storage
              .setItem(BD_OPENAI_CONFIG_KEY, getSerializableState())
              .catch((err) =>
                console.error("Failed to save SSOOAI route config:", err),
              );
          },

          updateCustomRouteConfig: (config) => {
            set((state) => ({
              ...state,
              customRoute: { ...state.customRoute, ...config },
              ...((config.apiKey !== undefined &&
                config.apiKey !== state.customRoute.apiKey) ||
              (config.proxyUrl !== undefined &&
                config.proxyUrl !== state.customRoute.proxyUrl)
                ? {
                    customModels: [],
                    customRoute: { ...state.customRoute, ...config, model: "" },
                  }
                : {}),
            }));
            // 保存到存储，只保存可序列化的数据
            storage
              .setItem(BD_OPENAI_CONFIG_KEY, getSerializableState())
              .catch((err) =>
                console.error("Failed to save custom route config:", err),
              );
          },

          updateRouteEnabled: (routeType: AIRouteType, enabled: boolean) => {
            set((state) => ({
              ...state,
              routeEnabled: {
                ...state.routeEnabled,
                [routeType]: enabled,
              },
            }));
            // 保存到存储，只保存可序列化的数据
            storage
              .setItem(BD_OPENAI_CONFIG_KEY, getSerializableState())
              .catch((err) =>
                console.error("Failed to save route enabled state:", err),
              );
          },

          resetConfig: () => {
            for (const route of Object.keys(modelRequests) as AIRouteType[])
              modelRequests[route]++;
            set(defaultOpenAIConfig);
          },

          syncConfig: async () => {
            try {
              const savedConfig = await storage.getItem(BD_OPENAI_CONFIG_KEY);

              if (savedConfig) {
                // 只提取我们需要的可序列化字段
                const serializableConfig = savedConfig as Partial<OpenAIConfig>;

                // 确保只更新有效字段，而不是完全覆盖
                set((state) => ({
                  ...state,
                  routeType: serializableConfig.routeType || state.routeType,
                  defaultRoute:
                    serializableConfig.defaultRoute || state.defaultRoute,
                  utoolsRoute:
                    serializableConfig.utoolsRoute || state.utoolsRoute,
                  ssooaiRoute:
                    serializableConfig.ssooaiRoute || state.ssooaiRoute,
                  customRoute:
                    serializableConfig.customRoute || state.customRoute,
                  routeEnabled: {
                    ...state.routeEnabled,
                    ...serializableConfig.routeEnabled,
                    default: true,
                  },
                }));
              }
            } catch (error) {
              console.error("Failed to sync OpenAI config:", error);
            }
          },

          fetchDefaultModels: () => get().fetchModels("default"),
          fetchUtoolsModels: () => get().fetchModels("utools"),
          fetchSsooaiModels: () => get().fetchModels("ssooai"),
          fetchCustomModels: () => get().fetchModels("custom"),

          fetchModels: async (route) => {
            const key = AI_ROUTE_CONFIG_KEYS[route];
            const listKey = AI_ROUTE_MODEL_KEYS[route];
            const initial = get()[key];
            const credentials =
              "apiKey" in initial
                ? { apiKey: initial.apiKey, proxyUrl: initial.proxyUrl }
                : null;
            const requestId = ++modelRequests[route];
            const isCurrent = () => {
              const current = get()[key];
              return (
                requestId === modelRequests[route] &&
                (!credentials ||
                  ("apiKey" in current &&
                    current.apiKey === credentials.apiKey &&
                    current.proxyUrl === credentials.proxyUrl))
              );
            };
            try {
              let models: Array<{ value: string; label: string }>;
              if (route === "utools") {
                if (!isUtoolsAvailable) throw new Error("uTools API 不可用");
                const result = await (window as any).utools.allAiModels();
                if (!Array.isArray(result))
                  throw new Error("模型列表格式不正确");
                models = result.flatMap((model) =>
                  typeof model?.id === "string" && model.id.trim()
                    ? [
                        {
                          value: model.id,
                          label: `${model.label || model.id}${model.cost > 0 ? ` (${model.cost}积分)` : ""}`,
                        },
                      ]
                    : [],
                );
              } else {
                if (
                  credentials &&
                  (!credentials.apiKey || !credentials.proxyUrl)
                )
                  throw new Error("请先配置 API 地址和密钥");
                const baseURL =
                  credentials?.proxyUrl.replace(/\/+$/, "") ||
                  DEFAULT_ROUTE_PROXY_URL;
                const response = await fetch(`${baseURL}/models`, {
                  headers: credentials
                    ? { Authorization: `Bearer ${credentials.apiKey}` }
                    : undefined,
                  signal: AbortSignal.timeout(10000),
                });
                if (!response.ok)
                  throw new Error(
                    route === "default" && response.status === 503
                      ? "站点API尚未配置，请联系管理员或使用私有API"
                      : "获取模型失败，请检查 API 配置后重试",
                  );
                const data = await response.json();
                if (!Array.isArray(data?.data))
                  throw new Error("模型列表格式不正确");
                models = data.data.flatMap((item: { id?: unknown }) =>
                  typeof item?.id === "string" && item.id.trim()
                    ? [{ value: item.id, label: item.id }]
                    : [],
                );
              }
              models = [
                ...new Map(
                  models.map((model) => [model.value, model]),
                ).values(),
              ];
              if (!isCurrent()) return;
              set((state) => ({
                [listKey]: models,
                [key]: {
                  ...state[key],
                  model: models.some((m) => m.value === state[key].model)
                    ? state[key].model
                    : models[0]?.value || "",
                },
              }));
              await storage.setItem(
                BD_OPENAI_CONFIG_KEY,
                getSerializableState(),
              );
            } catch (error) {
              if (!isCurrent()) return;
              set((state) => ({
                [listKey]: [],
                [key]: { ...state[key], model: "" },
              }));
              throw error;
            }
          },

          // 获取当前线路的配置
          getCurrentRouteConfig: () => {
            const state = get();

            switch (state.routeType) {
              case "default":
                return state.defaultRoute;
              case "utools":
                return state.utoolsRoute;
              case "ssooai":
                return state.ssooaiRoute;
              case "custom":
                return state.customRoute;
              default:
                return state.defaultRoute;
            }
          },

          // 获取当前线路的 API Key
          getCurrentApiKey: () => {
            const state = get();

            switch (state.routeType) {
              case "default":
              case "utools":
                return "";
              case "ssooai":
                return state.ssooaiRoute.apiKey;
              case "custom":
                return state.customRoute.apiKey;
              default:
                return "";
            }
          },

          // 获取当前线路的 API 地址
          getCurrentProxyUrl: () => {
            const state = get();

            switch (state.routeType) {
              case "default":
                return DEFAULT_ROUTE_PROXY_URL;
              case "utools":
                return "";
              case "ssooai":
                return state.ssooaiRoute.proxyUrl;
              case "custom":
                return state.customRoute.proxyUrl;
              default:
                return DEFAULT_ROUTE_PROXY_URL;
            }
          },

          // 获取当前线路的模型
          getCurrentModel: () => {
            const config = get().getCurrentRouteConfig();

            return getAIModels(get(), get().routeType).some(
              (model) => model.value === config.model,
            )
              ? config.model
              : "";
          },
        };
      },
      {
        name: "OpenAIConfigStore",
        enabled: true,
      },
    ),
  ),
);

// 注意：所有的更新操作已经在各自的方法中包含了保存到存储的逻辑
// 不需要额外的订阅来保存，这可能导致序列化错误
