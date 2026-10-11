import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";

import { WALManager } from "@/lib/storage/WALManager";
import { ensureBrandMigration } from "@/lib/storage/brandMigration";
import { getLockManager } from "@/lib/storage/DistributedLockManager";

import "@/styles/globals.css";
import DefaultLayout from "@/layouts/default";
import { FontSizeManager } from "@/components/FontSizeManager";
import UtoolsListener from "@/services/utoolsListener";
import { PWAUpdateManager } from "@/components/pwa/PWAUpdateManager";
import { ThemeColorManager } from "@/components/ThemeColorManager";

// 初始化存储系统
const initializeStorage = async () => {
  try {
    console.log("初始化存储系统...");
    await ensureBrandMigration();

    // 1. 恢复 WAL（写前日志）
    const walManager = new WALManager();

    await walManager.recover();

    // 2. 清理过期的分布式锁
    const lockManager = getLockManager();

    await lockManager.cleanupExpiredLocks();

    console.log("存储系统初始化完成");
  } catch (error) {
    console.error("存储系统初始化失败:", error);
    throw error;
  }
};

// 初始化 Utools 监听器
const initializeUtoolsListener = () => {
  setTimeout(() => {
    UtoolsListener.getInstance().initialize();
  }, 0);
};

// 监听应用加载完成事件
async function startApp() {
  await initializeStorage();
  initializeUtoolsListener();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <HashRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Provider>
          <ThemeColorManager />
          <FontSizeManager />
          <DefaultLayout>
            <App />
          </DefaultLayout>
          {/* PWA 更新管理组件 */}
          <PWAUpdateManager />
        </Provider>
      </HashRouter>
    </React.StrictMode>,
  );
}
void startApp().catch((error) => {
  const root = document.getElementById("root")!;
  root.textContent = `数据迁移或恢复失败，旧数据已保留。请刷新重试。${String(error)}`;
});
