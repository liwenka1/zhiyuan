export interface ProseLayoutOptions {
  baseFontSize: number;
  outerBackground: string;
  innerBackground: string;
  contentWidth: number;
  cardPadding: number;
}

export function generateProseLayoutStyles(options: ProseLayoutOptions): string {
  return `
    /* 基础重置 */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      font-family: "LXGW WenKai", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      font-size: ${options.baseFontSize}px;
      line-height: 1.5;
      letter-spacing: 0.5px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      background-color: ${options.outerBackground};
      padding: 2rem 1.25rem;
      margin: 0;
    }

    .export-layout-shell {
      width: 100%;
      max-width: ${options.contentWidth}px;
      margin: 0 auto;
      background-color: ${options.innerBackground};
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
    }

    .export-layout-content {
      padding: ${options.cardPadding}px;
    }
  `;
}
