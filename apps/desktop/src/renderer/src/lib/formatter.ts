import * as prettier from "prettier/standalone";
import markdownPlugin from "prettier/plugins/markdown";

// 用于保护内容的占位符（使用 HTML 注释格式，Prettier 不会修改它）
const PLACEHOLDER_PREFIX = "<!--PROTECTED";
const PLACEHOLDER_SUFFIX = "-->";

interface ProtectedContent {
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
    codeBlocks: new Map(),
    setextHeadings: new Map()
  };

  let processed = content;
  let index = 0;

  // 1. 先保护代码块（```...```）
  const codeBlockRegex = /```[\s\S]*?```/g;
  processed = processed.replace(codeBlockRegex, (match) => {
    const placeholder = `${PLACEHOLDER_PREFIX}CB${index}${PLACEHOLDER_SUFFIX}`;
    protectedContent.codeBlocks.set(placeholder, match);
    index++;
    return placeholder;
  });

  // 2. 保护 Setext 风格的标题（文本后紧跟 === 或 ---）
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
    const result = restoreProtectedContent(formatted, protectedContent);

    return result;
  } catch (error) {
    console.error("格式化 Markdown 失败:", error);
    // 格式化失败时返回原内容
    return content;
  }
}
