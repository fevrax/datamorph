import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/indexPage";
const SettingsPage = lazy(() => import("@/pages/settingPage"));

/** 页面级加载占位符 */
const PageLoader = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="text-sm text-muted-foreground">加载中...</div>
  </div>
);

function App() {
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
