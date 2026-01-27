import { Note } from "@/types";
import { markdownToHTML } from "@/lib/markdown-processor";
import { generateWechatHTMLDocument } from "@/lib/wechat-html";
import { inlineCSS } from "@/lib/css-inliner";

/**
 * 复制笔记到微信公众号
 */
export async function copyNoteToWechat(note: Note): Promise<void> {
  try {
    // 1. 将 Markdown 转换为 HTML
    const htmlBody = await markdownToHTML(note.content);

    // 2. 生成适配微信公众号的 HTML 文档
    const wechatHTML = generateWechatHTMLDocument(note.title, htmlBody);

    // 3. 将 CSS 内联化（在渲染进程处理）
    const inlinedHTML = inlineCSS(wechatHTML);

    // 4. 复制到剪贴板
    await window.api.export.copyHTMLToClipboard(inlinedHTML);

    console.log("已复制到剪贴板，可直接粘贴到微信公众号编辑器");
  } catch (error) {
    console.error("复制到微信公众号失败:", error);
    throw error;
  }
}
