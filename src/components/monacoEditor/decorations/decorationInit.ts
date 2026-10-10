import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import { Json5LanguageDef } from "../MonacoLanguageDef";
import { registerDecoderProviders } from "./decoderEngine";
let isInitialized = false;
let baseProviderRegistered = false;

// 初始化 Promise，保证全局只执行一次
let initPromise: Promise<void> | null = null;

/**
 * 初始化Monaco编辑器全局配置
 *
 * 幂等操作：多次调用只会执行一次初始化。
 * @returns 初始化后的Monaco实例
 */
export const initMonacoGlobally = async () => {
  if (isInitialized) return;

  if (!initPromise) {
    initPromise = (async () => {
      console.log("Initializing Monaco editor globally");

      // 配置Monaco加载器
      loader.config({ monaco });

      // 初始化Monaco实例
      const monacoInstance = await loader.init();

      // 注册JSON5语言支持
      if (
        !monacoInstance.languages
          .getLanguages()
          .some((lang) => lang.id === "json5")
      ) {
        monacoInstance.languages.register({ id: "json5" });
        monacoInstance.languages.setMonarchTokensProvider(
          "json5",
          Json5LanguageDef,
        );
      }

      isInitialized = true;
    })();
  }

  await initPromise;
};

/**
 * 注册Base64、Unicode、URL全局悬停提供者
 * 这些提供者将在所有JSON和JSON5编辑器中共享使用
 */
export const registerGlobalBase64Provider = () => {
  if (baseProviderRegistered) return;
  registerDecoderProviders();
  baseProviderRegistered = true;
};
