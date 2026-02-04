import * as prettier from "prettier/standalone";
import markdownPlugin from "prettier/plugins/markdown";

// 用于保护内容的占位符（使用 HTML 注释格式，Prettier 不会修改它）
const PLACEHOLDER_PREFIX = "<!--PROTECTED";
const PLACEHOLDER_SUFFIX = "-->";

interface ProtectedContent {
  frontmatter: string | null;
  codeBlocks: Map<string, string>;
  setextHeadings: Map<string, string>;
}

/**
 * 提取并保护需要保留的内容（代码块和 Setext 标题）
 * @param content - 原始 Markdown 内容
 * @returns 处理后的内容和保护内容映射
 */
function extractProtectedContent(content: string): { processed: string; protected: ProtectedContent } {
  const protectedContent: ProtectedContent = {
    frontmatter: null,
    codeBlocks: new Map(),
    setextHeadings: new Map()
  };

  let processed = content;
  let index = 0;

  // 1. 保护 frontmatter（最高优先级）
  // 匹配开头的 ---...--- 区域
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  const frontmatterMatch = processed.match(frontmatterRegex);
  if (frontmatterMatch) {
    protectedContent.frontmatter = frontmatterMatch[0];
    const placeholder = `${PLACEHOLDER_PREFIX}FM${PLACEHOLDER_SUFFIX}`;
    processed = processed.replace(frontmatterRegex, placeholder + "\n");
  }

  // 2. 保护代码块（```...```）
  const codeBlockRegex = /```[\s\S]*?```/g;
  processed = processed.replace(codeBlockRegex, (match) => {
    const placeholder = `${PLACEHOLDER_PREFIX}CB${index}${PLACEHOLDER_SUFFIX}`;
    protectedContent.codeBlocks.set(placeholder, match);
    index++;
    return placeholder;
  });

  // 3. 保护 Setext 风格的标题（文本后紧跟 === 或 ---）
  // 匹配：非空行 + 换行 + 仅由 = 或 - 组成的行（至少3个字符）
  const setextHeadingRegex = /^(.+)\n(={3,}|-{3,})$/gm;
  processed = processed.replace(setextHeadingRegex, (match) => {
    const placeholder = `${PLACEHOLDER_PREFIX}SH${index}${PLACEHOLDER_SUFFIX}`;
    protectedContent.setextHeadings.set(placeholder, match);
    index++;
    return placeholder;
  });

  return { processed, protected: protectedContent };
}

/**
 * 恢复保护的内容
 * @param content - 包含占位符的内容
 * @param protectedContent - 保护内容映射
 * @returns 恢复后的内容
 */
function restoreProtectedContent(content: string, protectedContent: ProtectedContent): string {
  let result = content;

  // 恢复 frontmatter（最先恢复）
  if (protectedContent.frontmatter) {
    const placeholder = `${PLACEHOLDER_PREFIX}FM${PLACEHOLDER_SUFFIX}`;
    result = result.replace(placeholder, protectedContent.frontmatter.trimEnd());
  }

  // 恢复 Setext 标题
  for (const [placeholder, heading] of protectedContent.setextHeadings) {
    result = result.replace(placeholder, heading);
  }

  // 恢复代码块
  for (const [placeholder, codeBlock] of protectedContent.codeBlocks) {
    result = result.replace(placeholder, codeBlock);
  }

  return result;
}

/**
 * 使用 Prettier 格式化 Markdown 内容
 * @param content - 要格式化的 Markdown 文本
 * @returns 格式化后的 Markdown 文本
 */
export async function formatMarkdown(content: string): Promise<string> {
  try {
    // 1. 提取并保护代码块和 Setext 标题
    const { processed, protected: protectedContent } = extractProtectedContent(content);

    // 2. 格式化处理后的内容
    const formatted = await prettier.format(processed, {
      parser: "markdown",
      plugins: [markdownPlugin],
      printWidth: 120,
      tabWidth: 2,
      useTabs: false,
      singleQuote: false,
      semi: true,
      trailingComma: "none",
      bracketSpacing: true,
      endOfLine: "lf",
      proseWrap: "preserve",
      embeddedLanguageFormatting: "off" // 关闭嵌入式语言格式化，因为我们已经保护了代码块
    });

    // 3. 恢复保护的内容
    let result = restoreProtectedContent(formatted, protectedContent);

    // 4. 后处理：智能清理 HTML 标签前的缩进
    // 只清理 1-3 个空格的缩进（可能是意外的）
    // 保留 4+ 个空格的缩进（用户想要代码块）
    result = result.replace(/^[ \t]{1,3}(<[a-zA-Z])/gm, "$1");

    return result;
  } catch {
    // 格式化失败时返回原内容
    return content;
  }
}
