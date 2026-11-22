import { t } from "@/i18n";
import { Suspense, lazy, useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/indexPage";
import { startTabAutoNaming } from "@/services/tabAutoNaming";
const SettingsPage = lazy(() => import("@/pages/settingPage"));

/** 页面级加载占位符 */
const PageLoader = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="text-sm text-muted-foreground">{t("加载中...")}</div>
  </div>
);

function App() {
  useEffect(() => startTabAutoNaming(), []);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<IndexPage />} path="/" />
        <Route element={<SettingsPage />} path="/settings" />
        <Route element={<IndexPage />} path="/toolbox" />
        <Route element={<IndexPage />} path="/toolbox/:toolId" />
      </Routes>
    </Suspense>
  );
}

export default App;
