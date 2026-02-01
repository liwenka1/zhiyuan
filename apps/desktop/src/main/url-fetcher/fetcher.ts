/**
 * URL 内容抓取器
 * 使用 @mozilla/readability 提取网页正文
 */

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface ArticleContent {
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
}

/**
 * 清理 HTML 内容
 * 移除无用的标签和属性，保留核心内容
 */
function cleanHTML(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // 1. 移除 HTML 注释
  const removeComments = (node: Node) => {
    const iterator = document.createNodeIterator(node, 128); // NodeFilter.SHOW_COMMENT = 128
    const comments: Node[] = [];
    let currentNode: Node | null;

    while ((currentNode = iterator.nextNode())) {
      comments.push(currentNode);
    }

    comments.forEach((comment) => comment.parentNode?.removeChild(comment));
  };
  removeComments(document.body);

  // 2. 移除所有 script 和 style 标签
  document.querySelectorAll("script, style").forEach((el) => el.remove());

  // 3. 移除所有无用属性
  document.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("class");
    el.removeAttribute("id");
    el.removeAttribute("style");
    el.removeAttribute("data-cfemail");
    el.removeAttribute("aria-label");
    el.removeAttribute("role");
  });

  // 4. 清理图片标签（只保留有内容的属性）
  document.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    const alt = img.getAttribute("alt");
    const title = img.getAttribute("title");

    // 移除所有属性
    Array.from(img.attributes).forEach((attr) => {
      img.removeAttribute(attr.name);
    });

    // 只保留有内容的属性
    if (src) img.setAttribute("src", src);
    if (alt && alt.trim()) img.setAttribute("alt", alt);
    if (title && title.trim()) img.setAttribute("title", title);
  });

  // 5. 清理链接（只保留 href）
  document.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    Array.from(a.attributes).forEach((attr) => {
      a.removeAttribute(attr.name);
    });
    if (href) a.setAttribute("href", href);
  });

  // 6. 移除空的 div 和 span
  let changed = true;
  while (changed) {
    changed = false;
    document.querySelectorAll("div, span").forEach((el) => {
      const hasText = el.textContent?.trim();
      const hasMedia = el.querySelector("img, video, audio");
      if (!hasText && !hasMedia) {
        el.remove();
        changed = true;
      }
    });
  }

  // 7. 扁平化嵌套的 div（多次迭代直到无法再简化）
  let simplified = true;
  while (simplified) {
    simplified = false;
    document.querySelectorAll("div").forEach((div) => {
      // 如果 div 只有一个子元素，且是块级元素，则提取内容
      if (div.children.length === 1) {
        const child = div.children[0];
        if (["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6"].includes(child.tagName)) {
          while (child.firstChild) {
            div.parentNode?.insertBefore(child.firstChild, div);
            simplified = true;
          }
          div.remove();
        }
      }
    });
  }

  // 8. 清理文本节点中的多余空白
  const cleanWhitespace = (node: Node) => {
    if (node.nodeType === 3) {
      // Text node
      const text = node.textContent || "";
      // 将多个连续的空白字符（空格、换行、制表符）替换为单个空格
      const cleaned = text.replace(/\s+/g, " ");
      node.textContent = cleaned;
    }
    node.childNodes.forEach((child) => cleanWhitespace(child));
  };
  cleanWhitespace(document.body);

  // 9. 获取最终的 HTML
  let result = document.body.innerHTML;

  // 10. 先移除所有标签间的空白
  result = result.replace(/>\s+</g, "><");

  // 11. 在块级元素后添加换行符，便于阅读
  const blockElements = [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr"
  ];

  blockElements.forEach((tag) => {
    // 在闭合标签后添加换行
    const closeTag = `</${tag}>`;
    result = result.replace(new RegExp(closeTag, "g"), `${closeTag}\n`);
  });

  // 12. 清理多余的空行（保留单个换行）
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  // 13. 移除开头和结尾的无用 div 标签
  if (result.startsWith("<div>") && result.endsWith("</div>")) {
    result = result.slice(5, -6).trim();
  }

  return result;
}

/**
 * 从 URL 抓取网页内容并提取正文
 * @param url - 网页 URL
 * @returns 提取的文章内容
 */
export async function fetchArticleFromUrl(url: string): Promise<ArticleContent> {
  // 1. 验证 URL 格式
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  // 2. 抓取网页内容
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    // 设置超时
    signal: AbortSignal.timeout(30000) // 30 秒超时
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // 3. 使用 Readability 提取正文
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    throw new Error("Failed to extract article content from URL");
  }

  // 4. 清理 HTML 内容
  const cleanedContent = cleanHTML(article.content || "");

  // 5. 返回提取的内容
  return {
    title: article.title || urlObj.hostname,
    content: cleanedContent,
    textContent: article.textContent || "",
    excerpt: article.excerpt || ""
  };
}
