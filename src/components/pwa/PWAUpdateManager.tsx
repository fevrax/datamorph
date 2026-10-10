import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/components/ui";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

import toast from "@/utils/toast";
import { flushTabStore } from "@/store/useTabStore";
import { flushSettingsStore } from "@/store/useSettingsStore";

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
const UPDATE_REMINDER_DELAY = 30 * 60 * 1000;

const persistAppState = () =>
  Promise.all([flushTabStore(), flushSettingsStore()]);

export const PWAUpdateManager: React.FC = () => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const reminderTimer = useRef<number | undefined>(undefined);

  const reloadAfterSaving = useCallback(() => {
    void persistAppState()
      .catch((error) => {
        console.error("刷新前保存数据失败:", error);
      })
      .finally(() => window.location.reload());
  }, []);

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: reloadAfterSaving,
    onRegisteredSW: (_swUrl, nextRegistration) => {
      setRegistration(nextRegistration);
    },
    onRegisterError: (error) => {
      console.error("Service Worker 注册失败:", error);
    },
  });

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);

    try {
      await persistAppState();
      await updateServiceWorker();
    } catch (error) {
      console.error("更新失败:", error);
      toast.error("更新失败", "数据已保留，请稍后重试");
      setIsUpdating(false);
    }
  }, [updateServiceWorker]);

  const handleSnooze = useCallback(() => {
    setIsSnoozed(true);
    window.clearTimeout(reminderTimer.current);
    reminderTimer.current = window.setTimeout(
      () => setIsSnoozed(false),
      UPDATE_REMINDER_DELAY,
    );
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!offlineReady) return;

    toast.success("离线功能已就绪", "断网后仍可继续使用已缓存的工具");
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!registration) return;

    const checkForUpdate = () => {
      if (navigator.onLine && document.visibilityState === "visible") {
        void registration.update().catch((error) => {
          console.warn("检查 PWA 更新失败:", error);
        });
      }
    };

    const handleVisibilityChange = () => checkForUpdate();
    const updateTimer = window.setInterval(
      checkForUpdate,
      UPDATE_CHECK_INTERVAL,
    );

    window.addEventListener("online", checkForUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(updateTimer);
      window.removeEventListener("online", checkForUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [registration]);

  useEffect(
    () => () => {
      window.clearTimeout(reminderTimer.current);
    },
    [],
  );

  const showUpdate = needRefresh && !isSnoozed;

  if (!isOffline && !showUpdate) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      {isOffline ? (
        <div
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-warning/30 bg-content1/95 p-3 text-foreground shadow-lg backdrop-blur"
          role="status"
        >
          <div className="mt-0.5 rounded-lg bg-warning/15 p-2 text-warning">
            <WifiOff size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">网络连接已断开</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              已缓存的本地工具仍可使用，联网功能暂不可用。
            </p>
          </div>
        </div>
      ) : null}

      {showUpdate ? (
        <div
          className="pointer-events-auto rounded-xl border border-divider bg-content1/95 p-3 text-foreground shadow-lg backdrop-blur"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/15 p-2 text-primary">
              <RefreshCw size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">新版本已准备好</p>
                <Button
                  isIconOnly
                  aria-label="30 分钟后提醒"
                  className="-mr-1 -mt-1 h-7 min-w-7 text-muted-foreground"
                  isDisabled={isUpdating}
                  size="sm"
                  variant="light"
                  onPress={handleSnooze}
                >
                  <X size={16} />
                </Button>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                更新前会保存当前数据，随后自动重新载入。
              </p>
              <div className="mt-3 flex justify-end">
                <Button
                  color="primary"
                  isDisabled={isUpdating}
                  size="sm"
                  startContent={
                    isUpdating ? <Spinner color="white" size="sm" /> : null
                  }
                  onPress={handleUpdate}
                >
                  {isUpdating ? "正在更新" : "立即更新"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
