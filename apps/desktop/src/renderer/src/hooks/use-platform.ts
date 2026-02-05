import { useMemo } from "react";

/**
 * 检测当前操作系统平台的 Hook
 */
export function usePlatform() {
  return useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return {
      isMac: ua.includes("mac"),
      isWindows: ua.includes("win"),
      isLinux: ua.includes("linux")
    };
  }, []);
}
