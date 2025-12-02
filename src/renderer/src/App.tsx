import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { FolderTree } from "@/components/sidebar/folder-tree";
import { NoteList } from "@/components/sidebar/note-list";
import { EditorArea } from "@/components/editor/editor-area";

function App(): React.JSX.Element {
  // 临时模拟数据，后续会替换为真实数据
  const [folders] = useState([
    { id: "1", name: "工作" },
    { id: "2", name: "学习" },
    { id: "3", name: "生活" }
  ]);

  const [notes] = useState([
    { id: "1", title: "欢迎使用 xx-note", updatedAt: "刚刚" },
    { id: "2", title: "快速开始", updatedAt: "1小时前" },
    { id: "3", title: "Markdown 语法", updatedAt: "2小时前" }
  ]);

  const [selectedFolderId, setSelectedFolderId] = useState<string>();
  const [selectedNoteId, setSelectedNoteId] = useState<string>();
  const [editorContent, setEditorContent] = useState("");

  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    // 这里后续会根据选中的文件夹加载对应的笔记列表
    setSelectedNoteId(undefined);
    setEditorContent("");
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    // 这里后续会从文件系统加载内容
    setEditorContent(`这是笔记 ${noteId} 的内容...`);
  };

  return (
    <MainLayout
      leftSidebar={
        <FolderTree folders={folders} selectedFolderId={selectedFolderId} onSelectFolder={handleSelectFolder} />
      }
      rightSidebar={<NoteList notes={notes} selectedNoteId={selectedNoteId} onSelectNote={handleSelectNote} />}
      mainContent={<EditorArea content={editorContent} onChange={setEditorContent} />}
    />
  );
}

export default App;
