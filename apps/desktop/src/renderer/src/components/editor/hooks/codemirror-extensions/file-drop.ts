import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

// 支持的图片扩展名
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];

/**
 * 判断文件是否为图片
 */
function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * 生成 Markdown 文件引用语法
 */
function generateMarkdownFileReference(filePath: string, fileName: string): string {
  if (isImageFile(fileName)) {
    const altText = fileName.replace(/\.[^.]+$/, "");
    return `![${altText}](${filePath})`;
  }
  return `[${fileName}](${filePath})`;
}

/**
 * 创建文件拖放处理扩展
 * 在 CodeMirror 层面拦截文件拖放，防止默认的文本插入行为
 */
export function createFileDropExtension(): Extension {
  return EditorView.domEventHandlers({
    drop(event, view) {
      // 检查是否包含文件
      const hasFiles = event.dataTransfer?.types.includes("Files");
      if (!hasFiles) {
        return false; // 不是文件拖放，让 CodeMirror 默认处理
      }

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) {
        return false;
      }

      // 阻止 CodeMirror 的默认拖放处理
      event.preventDefault();

      // 获取拖放位置
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) {
        return true;
      }

      // 处理所有拖入的文件
      const markdownTexts: string[] = [];

      for (const file of Array.from(files)) {
        try {
          // 使用 Electron 的 webUtils.getPathForFile 获取文件路径
          const filePath = window.api.utils.getPathForFile(file);
          if (!filePath) continue;

          const markdown = generateMarkdownFileReference(filePath, file.name);
          markdownTexts.push(markdown);
        } catch (error) {
          console.error("Failed to get file path:", error);
          continue;
        }
      }

      if (markdownTexts.length === 0) {
        return true;
      }

      const insertText = markdownTexts.join("\n");

      // 插入生成的 Markdown 文本
      view.dispatch({
        changes: { from: pos, insert: insertText },
        selection: { anchor: pos + insertText.length }
      });

      return true; // 已处理，阻止进一步传播
    }
  });
}
