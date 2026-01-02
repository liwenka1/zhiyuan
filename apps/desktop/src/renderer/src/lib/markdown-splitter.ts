/**
 * Markdown 分割工具
 * 按分割线（thematic break）分割 Markdown 内容
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type { Root, Content } from "mdast";

/**
 * 按分割线分割 Markdown
 * @param markdown Markdown 内容
 * @returns 分割后的 Markdown 数组
 */
export function splitMarkdownByHr(markdown: string): string[] {
  // 解析 Markdown 为 AST
  const ast = unified().use(remarkParse).parse(markdown) as Root;

  const sections: Content[][] = [];
  let currentSection: Content[] = [];

  // 遍历 AST 节点
  for (const node of ast.children) {
    if (node.type === "thematicBreak") {
      // 遇到分割线，保存当前分片并开始新分片
      if (currentSection.length > 0) {
        sections.push(currentSection);
        currentSection = [];
      }
    } else {
      currentSection.push(node);
    }
  }

  // 保存最后一个分片
  if (currentSection.length > 0) {
    sections.push(currentSection);
  }

  // 将每个分片转换回 Markdown
  return sections.map((section) => {
    const sectionAst: Root = {
      type: "root",
      children: section
    };
    return unified().use(remarkStringify).stringify(sectionAst);
  });
}
