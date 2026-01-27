import { Note } from "@/types";

/**
 * 处理外部添加的文件
 */
export async function handleFileAdded(
  filePath: string,
  fullPath: string,
  _workspacePath: string,
  existingNotes: Note[]
): Promise<Note | null> {
  // 检查是否已存在（避免重复添加）
  const existingNote = existingNotes.find((n) => n.id === filePath);
  if (existingNote) return null;

  try {
    // 读取文件内容
    const { content } = await window.api.file.read(fullPath);

    // 解析文件路径，确定所属文件夹
    const pathParts = filePath.split("/");
    let folderId: string | null = null;

    if (pathParts.length > 1) {
      // 文件在子文件夹中
      folderId = pathParts[0];
    }

    // 提取文件名
    const fileName = pathParts[pathParts.length - 1];

    // 创建新笔记对象
    const newNote: Note = {
      id: filePath,
      title: fileName.replace(".md", ""),
      content,
      fileName,
      filePath: fullPath,
      folderId: folderId || undefined,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return newNote;
  } catch (error) {
    console.error("处理添加的文件失败:", error);
    return null;
  }
}

/**
 * 处理外部修改的文件
 */
export async function handleFileChanged(_filePath: string, fullPath: string): Promise<string | null> {
  try {
    // 读取更新后的内容
    const { content } = await window.api.file.read(fullPath);
    return content;
  } catch (error) {
    console.error("处理修改的文件失败:", error);
    return null;
  }
}
