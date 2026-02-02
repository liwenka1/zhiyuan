/**
 * URL 安全校验工具
 * 防止通过恶意协议（如 file:、shell:、javascript:）进行攻击
 */

/**
 * 安全的 URL 协议白名单
 */
const SAFE_PROTOCOLS = new Set([
  "https:",
  "http:",
  "mailto:",
  "local-resource:" // 自定义协议，用于加载本地资源
]);

/**
 * 检查 URL 是否使用安全的协议
 * @param url 要检查的 URL
 * @returns 是否安全
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return SAFE_PROTOCOLS.has(parsedUrl.protocol);
  } catch {
    // 无效的 URL 格式，认为不安全
    return false;
  }
}

/**
 * 获取被拒绝的协议名称（用于日志记录）
 * @param url 要检查的 URL
 * @returns 协议名称，如果 URL 无效则返回 null
 */
export function getRejectedProtocol(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    return SAFE_PROTOCOLS.has(parsedUrl.protocol) ? null : parsedUrl.protocol;
  } catch {
    return null;
  }
}
