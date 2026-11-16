import { authorizeLocalResourceUrl } from "@shared";

/** 只为最终预览/导出 HTML 加入窗口凭证，笔记正文保持可移植的路径。 */
export function authorizeLocalResourcesInHtml(html: string, token: string): string {
  if (!token || !html.includes("local-resource://")) return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of document.querySelectorAll("[src], [href], [poster], [srcset], [style]")) {
    for (const attribute of ["src", "href", "poster"]) {
      const value = element.getAttribute(attribute);
      if (!value?.startsWith("local-resource://")) continue;
      try {
        element.setAttribute(attribute, authorizeLocalResourceUrl(value, token));
      } catch {
        element.removeAttribute(attribute);
      }
    }
    const srcset = element.getAttribute("srcset");
    if (srcset) {
      element.setAttribute(
        "srcset",
        srcset.replace(/local-resource:\/\/[^\s,]+/g, (url) => {
          try {
            return authorizeLocalResourceUrl(url, token);
          } catch {
            return "";
          }
        })
      );
    }
    const style = element.getAttribute("style");
    if (style) {
      element.setAttribute(
        "style",
        style.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")]*))\s*\)/gi, (match, double, single, bare) => {
          const url = (double ?? single ?? bare).trim();
          if (!url.startsWith("local-resource://")) return match;
          try {
            return `url("${authorizeLocalResourceUrl(url, token)}")`;
          } catch {
            return 'url("")';
          }
        })
      );
    }
  }
  return document.body.innerHTML;
}
