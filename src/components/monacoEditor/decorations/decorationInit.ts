import * as monaco from "monaco-editor";
import { registerFormatProviders } from "../formatDocument";
import { loader } from "@monaco-editor/react";
import { dataLanguageDefinitions } from "../dataLanguageDefinitions";
import { DATA_FORMATS } from "@/utils/dataFormats";
import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution";
import "monaco-editor/esm/vs/basic-languages/xml/xml.contribution";
import "monaco-editor/esm/vs/basic-languages/ini/ini.contribution";
import { registerDecoderProviders } from "./decoderEngine";
import { registerEditorTheme } from "../editorTheme";
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
  if (isInitialized) return monaco;

  if (!initPromise) {
    initPromise = (async () => {
      console.log("Initializing Monaco editor globally");

      // 配置Monaco加载器
      loader.config({ monaco });

      // 初始化Monaco实例
      const monacoInstance = await loader.init();
      registerEditorTheme(monacoInstance);

      for (const { id, highlighter } of DATA_FORMATS) {
        if (highlighter === "builtin") continue;
        const definition = dataLanguageDefinitions[highlighter];
        if (
          !monacoInstance.languages
            .getLanguages()
            .some((lang) => lang.id === id)
        )
          monacoInstance.languages.register({ id });
        monacoInstance.languages.setMonarchTokensProvider(id, definition);
        monacoInstance.languages.setLanguageConfiguration(id, {
          brackets: [
            ["{", "}"],
            ["[", "]"],
          ],
          autoClosingPairs: [
            { open: '"', close: '"' },
            { open: "[", close: "]" },
            { open: "{", close: "}" },
          ],
        });
      }

      registerFormatProviders();
      isInitialized = true;
    })();
  }

  await initPromise;
  return monaco;
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
