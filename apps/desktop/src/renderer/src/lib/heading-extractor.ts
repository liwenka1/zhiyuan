import GithubSlugger from "github-slugger";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * 从 Markdown 内容中提取标题
 * 跳过代码块、引用块、HTML 注释中的标题
 * 使用 github-slugger 生成 ID（与 rehype-slug 完全一致）
 */
export function extractHeadings(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split("\n");
  const slugger = new GithubSlugger();

  let inCodeBlock = false;
  let inHtmlComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 检测 HTML 注释
    if (trimmedLine.includes("<!--")) {
      inHtmlComment = true;
    }
    if (trimmedLine.includes("-->")) {
      inHtmlComment = false;
      continue;
    }
    if (inHtmlComment) {
      continue;
    }

    // 检测代码块（围栏式代码块 ``` 或缩进式代码块）
    if (trimmedLine.startsWith("```") || trimmedLine.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // 如果在代码块内，跳过
    if (inCodeBlock) {
      continue;
    }

    // 跳过缩进代码块（4个空格或1个tab开头）
    if (line.match(/^( {4}|\t)/)) {
      continue;
    }

    // 跳过引用块中的标题（> 开头）
    if (trimmedLine.startsWith(">")) {
      continue;
    }

    // 匹配 # 标题语法（必须在行首）
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = slugger.slug(text);

      if (id) {
        headings.push({ id, text, level });
      }
      continue;
    }

    // 匹配 HTML 标题标签（用于 HTML 内容）
    const htmlHeadingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let htmlMatch: RegExpExecArray | null;
    while ((htmlMatch = htmlHeadingRegex.exec(line))) {
      const level = Number(htmlMatch[1]);
      const rawText = htmlMatch[2];
      const text = rawText
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const id = slugger.slug(text);
      if (id) {
        headings.push({ id, text, level });
      }
    }
  }

  return headings;
}
