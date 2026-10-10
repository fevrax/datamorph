import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";

import {
  collectOpenAIStream,
  collectUtoolsStream,
  runAICompletion,
  type AICompletionCallbacks,
  type AIRequestOptions,
} from "./aiRequestLifecycle";

import {
  useOpenAIConfigStore,
  AIRouteType,
  DEFAULT_ROUTE_PROXY_URL,
} from "@/store/useOpenAIConfigStore.ts";
import { AI_ROUTE_CONFIG_KEYS } from "./aiModelSelection";
import toast from "@/utils/toast.tsx";

// 检查 utools 是否可用
const isUtoolsAvailable = typeof window !== "undefined" && "utools" in window;

/**
 * OpenAI 服务
 * 提供与 OpenAI API 通信的基础功能
 */
export class OpenAIService {
  private openai: OpenAI | null = null;
  private routeType: AIRouteType = "default";
  maxTokens: number = 10000;

  // 添加config公共属性，用于存储和恢复配置
  public config = {
    routeType: "default" as AIRouteType,
    model: "",
    temperature: 0.7,
  };

  /**
   * 初始化OpenAI服务
   */
  constructor() {
    // 空构造函数，通过 syncConfig 初始化
  }

  /**
   * 从store同步配置
   */
  public syncConfig(): void {
    const openaiStore = useOpenAIConfigStore.getState();

    this.routeType = openaiStore.routeType;
    this.config = {
      routeType: openaiStore.routeType,
      model: openaiStore.getCurrentModel(),
      temperature: openaiStore.getCurrentRouteConfig().temperature,
    };
    this.initOpenAI();
  }

  /**
   * 获取当前线路的 API Key
   */
  private getCurrentApiKey(): string {
    const state = useOpenAIConfigStore.getState();

    return this.routeType === "ssooai"
      ? state.ssooaiRoute.apiKey
      : this.routeType === "custom"
        ? state.customRoute.apiKey
        : "";
  }

  /**
   * 获取当前线路的 API 地址
   */
  private getCurrentProxyUrl(): string {
    const state = useOpenAIConfigStore.getState();

    return this.routeType === "ssooai"
      ? state.ssooaiRoute.proxyUrl
      : this.routeType === "custom"
        ? state.customRoute.proxyUrl
        : DEFAULT_ROUTE_PROXY_URL;
  }

  private async resolveModel(): Promise<string> {
    if (this.config.model) return this.config.model;
    const route = this.routeType;
    const state = useOpenAIConfigStore.getState();
    await state.fetchModels(route);
    const latest = useOpenAIConfigStore.getState();
    const model = latest[AI_ROUTE_CONFIG_KEYS[route]].model;
    if (!model) throw new Error("API 暂未返回可用模型，请检查配置后重试");
    if (this.routeType === route) this.config.model = model;
    return model;
  }

  /**
   * 获取当前线路的温度参数
   */
  private getCurrentTemperature(): number {
    return this.config.temperature;
  }

  /**
   * 初始化OpenAI客户端
   */
  private initOpenAI(): void {
    this.openai = null;
    // 如果是 utools 线路，不需要初始化 OpenAI 客户端
    if (this.routeType === "utools") {
      if (!isUtoolsAvailable) {
        toast.error("uTools API 不可用，请确保在 uTools 环境中运行");
        this.openai = null;
      }

      return;
    }

    const apiKey = this.getCurrentApiKey();
    const proxyUrl = this.getCurrentProxyUrl();

    if (this.routeType !== "default" && !apiKey) {
      this.openai = null;

      return;
    }

    // 根据不同的线路类型进行初始化
    switch (this.routeType) {
      case "default":
        if (
          typeof window === "undefined" ||
          !/^https?:$/.test(window.location.protocol)
        ) {
          return;
        }
        // SDK 要求 apiKey 非空，此占位值不是凭据，且不会发送 Authorization。
        this.openai = new OpenAI({
          apiKey: "site-proxy",
          baseURL: new URL(DEFAULT_ROUTE_PROXY_URL, window.location.origin)
            .href,
          defaultHeaders: { Authorization: null },
          dangerouslyAllowBrowser: true,
          maxRetries: 0,
          timeout: 120_000,
        });
        break;

      case "ssooai":
        // SSOOAI线路使用SSOOAI的API密钥和地址
        const ssooaiApiKey = useOpenAIConfigStore.getState().ssooaiRoute.apiKey;
        const ssooaiProxyUrl =
          useOpenAIConfigStore.getState().ssooaiRoute.proxyUrl;

        if (!ssooaiApiKey) {
          this.openai = null;

          return;
        }

        this.openai = new OpenAI({
          apiKey: ssooaiApiKey,
          baseURL: ssooaiProxyUrl,
          dangerouslyAllowBrowser: true,
        });
        break;

      case "custom":
        this.openai = new OpenAI({
          apiKey,
          baseURL: proxyUrl,
          dangerouslyAllowBrowser: true,
        });
        break;
    }
  }

  /**
   * 验证服务是否已准备好
   */
  private validateService(): boolean {
    // 如果是 utools 线路，检查 utools 是否可用
    if (this.routeType === "utools") {
      if (!isUtoolsAvailable) {
        toast.error("uTools API 不可用，请确保在 uTools 环境中运行");

        return false;
      }

      return true;
    }

    if (!this.openai) {
      const apiKey = this.getCurrentApiKey();

      if (!apiKey) {
        if (this.routeType === "custom" || this.routeType === "ssooai") {
          toast.error("请在设置中输入您的 API 密钥");
        } else {
          toast.error("站点 AI 线路不可用，请配置私有API或联系站点管理员");
        }
      } else {
        this.initOpenAI();
        if (!this.openai) {
          toast.error("OpenAI 服务初始化失败");

          return false;
        }
      }

      return false;
    }

    return true;
  }

  /** Send a streaming request. The optional third argument preserves existing page callers. */
  public async createChatCompletion(
    messages: ChatCompletionMessageParam[],
    callbacks: AICompletionCallbacks = {},
    options: AIRequestOptions = {},
  ): Promise<boolean> {
    const routeType = this.routeType;

    return runAICompletion(
      async (request, guarded) => {
        request.check();
        if (!this.validateService())
          throw new Error("AI服务未初始化或配置错误");
        const model = await this.resolveModel();
        request.check();

        if (this.routeType === "utools") {
          guarded.onProcessing?.("连接到 uTools AI...");

          return collectUtoolsStream(request, guarded, (onChunk) =>
            (window as any).utools.ai(
              {
                model,
                messages: messages.map(({ role, content }) => ({
                  role,
                  content,
                })),
              },
              onChunk,
            ),
          );
        }
        guarded.onProcessing?.("Connecting to OpenAI...");

        return collectOpenAIStream(request, guarded, () =>
          this.openai!.chat.completions.create(
            {
              model,
              messages,
              temperature: this.getCurrentTemperature(),
              stream: true,
            },
            { signal: request.signal, maxRetries: 0 },
          ),
        );
      },
      {
        ...callbacks,
        onError: (error) => {
          if (
            routeType === "default" &&
            (error as Error & { status?: number }).status === 503
          ) {
            callbacks.onError?.(
              new Error("站点 AI 线路尚未配置，请使用私有API。"),
            );
          } else callbacks.onError?.(error);
        },
      },
      options,
    );
  }

  /**
   * 测试AI线路连接
   * @param routeType 要测试的线路类型
   * @returns 返回一个Promise，成功则resolve，失败则reject
   */
  public async testConnection(routeType: AIRouteType): Promise<boolean> {
    // 保存当前线路类型
    const currentRouteType = this.routeType;

    try {
      // 临时切换到要测试的线路
      this.routeType = routeType;
      this.initOpenAI();

      // 根据不同线路类型进行测试
      switch (routeType) {
        case "default":
          // 测试默认线路
          if (!this.openai) {
            throw new Error("默认线路初始化失败");
          }

          // 简单测试API可用性
          if (this.openai) {
            await this.openai.models.list();
          } else {
            throw new Error("API客户端初始化失败");
          }

          return true;

        case "ssooai":
          // 测试SSOOAI线路
          const ssooaiApiKey =
            useOpenAIConfigStore.getState().ssooaiRoute.apiKey;
          const ssooaiProxyUrl =
            useOpenAIConfigStore.getState().ssooaiRoute.proxyUrl;

          if (!ssooaiApiKey) {
            throw new Error("请提供SSOOAI API密钥");
          }

          if (!ssooaiProxyUrl) {
            throw new Error("SSOOAI API地址配置错误");
          }

          // 临时创建SSOOAI客户端
          const ssooaiClient = new OpenAI({
            apiKey: ssooaiApiKey,
            baseURL: ssooaiProxyUrl,
            dangerouslyAllowBrowser: true,
          });

          // 测试API可用性
          await ssooaiClient.models.list();

          // 测试成功后，获取模型列表
          await useOpenAIConfigStore.getState().fetchSsooaiModels();

          return true;

        case "utools":
          // 测试utools线路
          if (!isUtoolsAvailable) {
            throw new Error("uTools API 不可用，请确保在 uTools 环境中运行");
          }

          // 检查是否有可用模型
          const utoolsModels = useOpenAIConfigStore.getState().utoolsModels;

          if (!utoolsModels || utoolsModels.length === 0) {
            throw new Error("未找到可用的 uTools 模型");
          }

          // 简单测试一下 utools.ai API 是否可用
          if (!(window as any).utools || !(window as any).utools.ai) {
            throw new Error("uTools AI 功能不可用");
          }

          return true;

        case "custom":
          // 测试自定义线路
          if (!this.openai) {
            const apiKey = useOpenAIConfigStore.getState().customRoute.apiKey;
            const proxyUrl =
              useOpenAIConfigStore.getState().customRoute.proxyUrl;

            if (!apiKey) {
              throw new Error("请提供API密钥");
            }

            if (!proxyUrl) {
              throw new Error("请提供API地址");
            }

            throw new Error("自定义线路初始化失败");
          }

          // 简单测试API可用性
          if (this.openai) {
            await this.openai.models.list();

            // 测试成功后，获取模型列表
            await useOpenAIConfigStore.getState().fetchCustomModels();
          } else {
            throw new Error("API客户端初始化失败");
          }

          return true;

        default:
          throw new Error("未知的线路类型");
      }
    } catch (error) {
      console.error("测试线路失败:", error);
      throw error;
    } finally {
      // 恢复之前的线路类型
      this.routeType = currentRouteType;
      this.initOpenAI();
    }
  }

  /**
   * 创建一个预设的OpenAI服务实例
   * @returns OpenAIService实例
   */
  public static createInstance(): OpenAIService {
    const service = new OpenAIService();

    service.syncConfig();

    return service;
  }

  /**
   * 更新服务配置（用于测试）
   * @param newConfig 新配置
   */
  public updateConfig(newConfig: {
    routeType: AIRouteType;
    model: string;
    temperature?: number;
  }): void {
    this.routeType = newConfig.routeType;
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.initOpenAI();
  }

  /**
   * 非流式聊天请求（用于测试）
   * @param options 聊天参数
   * @returns 聊天完成结果
   */
  public async chat(options: {
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }): Promise<any> {
    // 验证服务是否已初始化
    if (!this.validateService()) {
      throw new Error("AI服务未初始化或配置错误");
    }

    const modelToUse = options.model || (await this.resolveModel());
    const temperature = options.temperature ?? this.getCurrentTemperature();

    try {
      // 为utools线路提供特殊处理
      if (this.routeType === "utools") {
        if (!isUtoolsAvailable) {
          throw new Error("uTools API 不可用");
        }

        return new Promise((resolve, reject) => {
          const utoolsMessages = options.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

          const utoolsOptions = {
            model: modelToUse,
            messages: utoolsMessages,
            temperature: temperature,
            max_tokens: options.max_tokens || this.maxTokens,
          };

          try {
            let responseContent = "";
            const promise = (window as any).utools.ai(
              utoolsOptions,
              (chunk: { content?: string }) => {
                if (chunk.content) {
                  responseContent += chunk.content;
                }
              },
            );

            promise
              .then(() => {
                resolve({
                  choices: [
                    {
                      message: {
                        role: "assistant",
                        content: responseContent,
                      },
                    },
                  ],
                });
              })
              .catch((err: Error) => {
                reject(err);
              });
          } catch (error) {
            reject(error);
          }
        });
      }

      // 对于其他线路，使用普通的完成请求
      if (!this.openai) {
        throw new Error("OpenAI客户端未初始化");
      }

      const response = await this.openai.chat.completions.create({
        model: modelToUse,
        messages: options.messages,
        temperature: temperature,
        max_tokens: options.max_tokens || this.maxTokens,
      });

      return response;
    } catch (error) {
      console.error("AI请求失败:", error);
      throw error;
    }
  }
}

// 导出单例实例
export const openAIService = OpenAIService.createInstance();
