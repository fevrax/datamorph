import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { siteAIProxy } from "./config/aiProxy";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import monacoEditorPlugin from "vite-plugin-monaco-editor-esm";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/

export default defineConfig(({ mode, command }) => ({
  cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite",
  optimizeDeps: {
    include: [
      "vanilla-jsoneditor-cn",
      "quicktype-core",
      "jsonrepair",
      "jsonpath-rfc9535",
      "js-yaml",
      "@iarna/toml",
      "xml-js",
    ],
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  worker: { format: "es", plugins: () => [nodePolyfills()] },
  server: {
    watch: {
      ignored: [
        "**/artifacts/**",
        "**/tests/**",
        "**/scripts/**",
        "**/*.test.*",
        "**/docs/redesign/**",
        "**/tests/**",
        "**/scripts/**",
        "**/*.test.*",
        "**/.pnpm-store/**",
      ],
    },
    host: "0.0.0.0", // 使用 '0.0.0.0' 允许从任何 IP 访问
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler", // or 'modern'
      },
    },
  },
  base: "./",
  plugins: [
    ...(command === "serve"
      ? [siteAIProxy(loadEnv(mode, process.cwd(), "OPENAI_"))]
      : []),
    tailwindcss(),
    react(),
    tsconfigPaths(),
    monacoEditorPlugin({
      languageWorkers: [
        "editorWorkerService",
        "json",
        "typescript",
        "css",
        "html",
      ],
    }),
    nodePolyfills(),
    VitePWA({
      registerType: "prompt",
      strategies: "generateSW",
      // public 目录中的静态资源已由 globPatterns 收集，避免与 manifest 图标重复。
      includeManifestIcons: false,
      workbox: {
        // Monaco 主包较大；完整预缓存可确保所有本地工具首次断网也可使用。
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: {
        enabled: false, // 在开发环境中禁用 PWA
        type: "module",
      },
      manifest: {
        name: "JSON Tools - 多功能JSON处理助手",
        short_name: "JSON Tools",
        description: "强大的JSON工具集，支持格式化、验证、转换、编辑等多种功能",
        id: "./",
        lang: "zh-CN",
        background_color: "#f4f4f5",
        display: "standalone",
        scope: "./",
        start_url: "./",
        theme_color: "#f4f4f5",
        categories: ["productivity", "developer", "utilities"],
        handle_links: "auto",
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "格式化 JSON",
            short_name: "格式化",
            description: "快速格式化 JSON 数据",
            url: "./",
            icons: [
              {
                src: "pwa-192x192.png",
                sizes: "192x192",
                type: "image/png",
              },
            ],
          },
        ],
      },
    }),
  ],
}));
