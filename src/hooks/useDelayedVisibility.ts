import { useEffect, useState } from "react";

/**
 * Avoid flashing transient status UI for work that completes almost instantly.
 */
export function useDelayedVisibility(visible: boolean, delay = 300) {
  const [delayedVisible, setDelayedVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDelayedVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setDelayedVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, visible]);

  return visible && delayedVisible;
}
