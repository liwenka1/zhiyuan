import * as prettier from "prettier/standalone";
import markdownPlugin from "prettier/plugins/markdown";

/**
 * 使用 Prettier 格式化 Markdown 内容
 * @param content - 要格式化的 Markdown 文本
 * @returns 格式化后的 Markdown 文本
 */
export async function formatMarkdown(content: string): Promise<string> {
  try {
    const formatted = await prettier.format(content, {
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
      embeddedLanguageFormatting: "auto"
    });
    return formatted;
  } catch (error) {
    console.error("格式化 Markdown 失败:", error);
    // 格式化失败时返回原内容
    return content;
  }
}
