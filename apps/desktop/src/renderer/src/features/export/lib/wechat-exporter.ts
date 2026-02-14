import { Note } from "@/types";
import { buildWechatDocument } from "./export-pipeline";
import { inlineCSS } from "@/lib/css-inliner";
import { exportIpc } from "@/ipc";
import type { ExportLayoutConfig } from "@shared";

/**
 * 复制笔记到微信公众号
 * @param note 要导出的笔记
 * @param themeId 导出主题预设 ID，决定导出颜色方案
 */
export async function copyNoteToWechat(
  note: Note,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<void> {
  // 1. 生成适配微信公众号的 HTML 文档
  const wechatHTML = await buildWechatDocument(note, themeId, layout);

  // 3. 将 CSS 内联化（在渲染进程处理）
  const inlinedHTML = inlineCSS(wechatHTML);

  // 4. 复制到剪贴板
  await exportIpc.copyHTMLToClipboard(inlinedHTML);
}
