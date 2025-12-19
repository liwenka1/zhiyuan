import { useEffect, useState } from "react";

/**
 * 检测当前操作系统平台的 Hook
 */
export function usePlatform() {
  const [isMac, setIsMac] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isLinux, setIsLinux] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsMac(ua.includes("mac"));
    setIsWindows(ua.includes("win"));
    setIsLinux(ua.includes("linux"));
  }, []);

  return { isMac, isWindows, isLinux };
}
