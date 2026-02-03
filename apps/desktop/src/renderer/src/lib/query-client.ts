/**
 * React Query 配置
 * 用于管理 IPC 调用的状态和缓存
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * 全局 Query Client 实例
 *
 * 配置说明：
 * - staleTime: 数据保鲜时间（5分钟），超过后自动重新获取
 * - cacheTime: 缓存时间（10分钟），超过后清除缓存
 * - retry: 失败重试次数（1次），避免无限重试
 * - refetchOnWindowFocus: 窗口聚焦时不自动刷新（避免干扰用户）
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟
      gcTime: 10 * 60 * 1000, // 10 分钟（原 cacheTime）
      retry: 1, // 失败重试 1 次
      refetchOnWindowFocus: false, // 不在窗口聚焦时自动刷新
      refetchOnReconnect: false, // 不在网络重连时自动刷新
      refetchOnMount: true // 组件挂载时刷新
    },
    mutations: {
      retry: 0 // mutation 不重试
    }
  }
});
