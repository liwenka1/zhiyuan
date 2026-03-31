export const translations = {
  zh: {
    brand: {
      name: "纸鸢",
      badge: "Open Source Markdown Editor",
      githubUrl: "https://github.com/liwenka1/zhiyuan",
      downloadUrl: "https://github.com/liwenka1/zhiyuan"
    },
    header: {
      features: "功能",
      workflow: "工作流",
      usecase: "使用场景",
      download: "GitHub"
    },
    hero: {
      eyebrow: "Local-first Markdown Workspace",
      title: "本地优先的 Markdown 工作台",
      description: "把 RSS、网页抓取、本地 Markdown、工作区终端、导出和 GitHub 发布收进同一条桌面工作流。",
      download: "前往 GitHub",
      learnMore: "查看功能",
      highlights: ["RSS 订阅", "URL 转 Markdown", "工作区终端", "多窗口", "PDF / HTML / 长图导出", "发布到 GitHub"]
    },
    proof: {
      eyebrow: "Why Zhiyuan",
      title: "它不是另一款在线文档，而是一条更完整的本地内容链路",
      description: "纸鸢更接近一款 Markdown-first 的桌面工作台：它同时处理内容输入、编辑整理与最终输出。",
      items: [
        {
          title: "Markdown-first",
          description: "采集、编辑、预览和导出都围绕原生 Markdown 文件展开。"
        },
        {
          title: "内容工作流完整",
          description: "RSS、网页、笔记、终端和导出被组织成同一条从输入到输出的链路。"
        },
        {
          title: "桌面专注流",
          description: "更适合喜欢本地文件、键盘流、多窗口和内嵌终端的写作者。"
        }
      ]
    },
    trust: {
      title: "为喜欢 Markdown 的工作流而设计",
      items: ["RSS", "Markdown", "GitHub", "Local Files", "Export", "Reader"]
    },
    preview: {
      eyebrow: "Workflow",
      title: "从采集到写作，再到导出发布，始终留在同一条 Markdown 流里",
      description: "真正重要的不是模块数量，而是它们之间的连接方式。",
      sideLabel: "How it works",
      sideTitle: "把原本分散在阅读器、剪藏工具、编辑器和导出工具里的动作，收拢到一个桌面工作区里。",
      sideDescription: "先采集，再编辑与预览，最后导出或发布，不必在每个阶段都切换工具和格式。",
      bullets: [
        {
          title: "Collect",
          description: "订阅 RSS，或把网页直接抓取成 Markdown 草稿，让外部内容先进入本地工作区。"
        },
        {
          title: "Write & run",
          description: "在同一个界面里继续写、改、预览、演示和打开终端，减少来回切换工具。"
        },
        {
          title: "Ship",
          description: "需要输出时，直接导出 PDF、HTML、长图，或推送到 GitHub Issue。"
        }
      ]
    },
    showcase: {
      items: [
        {
          eyebrow: "采集",
          title: "把 RSS 和网页采集拉回同一个入口",
          description: "从订阅到保存网页，都先进入一条统一的 Markdown 采集流，避免信息散在不同工具里。"
        },
        {
          eyebrow: "整理",
          title: "把抓取内容转换成可继续编辑的 Markdown",
          description: "网页正文不只是保存链接，而是转成干净的 Markdown 草稿，后续直接改写、重组和沉淀。"
        },
        {
          eyebrow: "输出",
          title: "写作、预览和导出保持在同一工作台",
          description: "你不需要在多个应用之间跳来跳去，写作完成后就能继续预览和导出。"
        }
      ]
    },
    features: {
      eyebrow: "Capabilities",
      title: "围绕 Markdown 工作流打磨的核心能力",
      description: "这些能力协同工作，而不是彼此孤立。",
      items: [
        {
          title: "RSS 订阅与归档",
          description: "把关注的信息源持续拉进本地工作区，方便阅读、筛选和沉淀。"
        },
        {
          title: "网页转 Markdown",
          description: "抓取正文并清理网页结构，把外部文章快速变成可继续编辑的 Markdown。"
        },
        {
          title: "工作区终端",
          description: "终端直接嵌在编辑区里，并跟随当前工作区启动，适合边写边处理命令行任务。"
        },
        {
          title: "预览与演示模式",
          description: "编辑、预览、分栏和演示模式切换清晰，覆盖写作、阅读和展示场景。"
        },
        {
          title: "多窗口与本地工作区",
          description: "支持围绕不同工作区打开多个窗口，让文件组织和桌面习惯保持一致。"
        },
        {
          title: "多格式导出",
          description: "支持 HTML、PDF、长图等导出路径，减少内容写完之后的二次整理。"
        },
        {
          title: "GitHub 发布",
          description: "可将笔记推送为 GitHub Issue，并处理本地资源上传，让写作直接接上发布入口。"
        },
        {
          title: "快捷键与桌面操作",
          description: "工作区、文件拖放、快捷键和终端切换都服务于真实的桌面键盘流。"
        }
      ]
    },
    desktopDetails: {
      eyebrow: "Desktop-native Details",
      title: "这些细节让它更像真正的桌面工作台",
      description: "除了主流程能力，纸鸢也补齐了许多真正属于桌面应用的交互细节。",
      items: [
        {
          title: "Markdown 拖入与拖出",
          description: "支持把外部 Markdown 文件拖入工作区，也支持把工作区内的笔记直接拖出到系统中继续使用。"
        },
        {
          title: "直接从系统打开 Markdown",
          description: "可以从操作系统直接打开 .md 文件或文件夹，并自动定位到对应工作区和内容。"
        },
        {
          title: "可配置快捷键",
          description: "终端切换、导入 RSS、创建笔记和切换模式都接进了快捷键系统。"
        },
        {
          title: "围绕工作区组织内容",
          description: "最近打开、工作区绑定窗口、本地文件结构和多窗口行为都围绕桌面目录组织方式展开。"
        }
      ]
    },
    usecase: {
      eyebrow: "Use Cases",
      label: "场景",
      title: "更适合这些真正以 Markdown 为中心的人",
      description: "它不是所有人的万能工具，但对这几类用户会更顺手。",
      items: [
        {
          title: "持续阅读与摘录",
          description: "如果你会长期看 RSS、收藏文章、做摘录，纸鸢能把阅读和沉淀都放回本地 Markdown。"
        },
        {
          title: "技术写作",
          description: "适合写博客草稿、产品方案、开发文档和结构化长文，不必再搬运到发布工具。"
        },
        {
          title: "个人知识归档",
          description: "网页、灵感、订阅文章和零碎笔记可以统一回收到同一个本地工作区。"
        },
        {
          title: "本地优先写作者",
          description: "如果你在意文件可控性、目录结构、键盘流、多窗口和内嵌终端，这套工作流会更接近你的习惯。"
        }
      ]
    },
    cta: {
      eyebrow: "Get Started",
      title: "现在就从 GitHub 开始体验纸鸢",
      description: "源码、Release 和后续迭代都已经在 GitHub 上，你可以先下载使用，也可以继续关注项目演进。",
      links: [
        {
          label: "GitHub 仓库",
          href: "https://github.com/liwenka1/zhiyuan"
        },
        {
          label: "查看 Releases",
          href: "https://github.com/liwenka1/zhiyuan/releases"
        }
      ],
      platforms: ["Windows", "macOS", "Linux"]
    },
    footer: {
      tagline: "本地优先的 Markdown 工作台",
      maintainer: {
        prefix: "由",
        name: "liwenka1",
        suffix: "维护",
        href: "https://github.com/liwenka1"
      },
      copyright: "© 2025 纸鸢笔记"
    }
  },
  en: {
    brand: {
      name: "Zhiyuan",
      badge: "Open Source Markdown Editor",
      githubUrl: "https://github.com/liwenka1/zhiyuan",
      downloadUrl: "https://github.com/liwenka1/zhiyuan"
    },
    header: {
      features: "Features",
      workflow: "Workflow",
      usecase: "Use Cases",
      download: "GitHub"
    },
    hero: {
      eyebrow: "Local-first Markdown Workspace",
      title: "A local-first Markdown workspace",
      description:
        "Bring RSS, web capture, local Markdown files, a workspace terminal, export and GitHub publishing into one desktop workflow.",
      download: "Open GitHub",
      learnMore: "Explore Features",
      highlights: [
        "RSS feeds",
        "URL to Markdown",
        "Workspace terminal",
        "Multi-window",
        "PDF / HTML / image export",
        "Publish to GitHub"
      ]
    },
    proof: {
      eyebrow: "Why Zhiyuan",
      title: "Not another online document tool, but a fuller local-first content flow",
      description:
        "Zhiyuan works more like a Markdown-first desktop workspace. It covers content input, refinement and output in one place.",
      items: [
        {
          title: "Markdown-first",
          description: "Collection, editing, preview and export stay centered around native Markdown files."
        },
        {
          title: "Connected workflow",
          description: "RSS, web capture, notes, terminal work and export form one continuous chain."
        },
        {
          title: "Desktop focus",
          description:
            "Built for people who prefer local files, keyboard-driven habits, multi-window setups and an embedded terminal."
        }
      ]
    },
    trust: {
      title: "Designed for people who genuinely like Markdown workflows",
      items: ["RSS", "Markdown", "GitHub", "Local Files", "Export", "Reader"]
    },
    preview: {
      eyebrow: "Workflow",
      title: "Keep capture, writing and output inside one Markdown flow",
      description: "The real value is not feature count, but how the pieces stay connected.",
      sideLabel: "How it works",
      sideTitle: "Pull actions that usually live across multiple tools back into one desktop workspace.",
      sideDescription:
        "Capture first, then write and preview, and export or publish last without switching tools at every stage.",
      bullets: [
        {
          title: "Collect",
          description:
            "Subscribe to RSS or capture a web page into Markdown so outside content enters your local workspace first."
        },
        {
          title: "Write & run",
          description: "Keep writing, editing, previewing, presenting and opening a terminal in the same interface."
        },
        {
          title: "Ship",
          description: "Export to PDF, HTML or long image, or push the note to GitHub Issue when it is ready."
        }
      ]
    },
    showcase: {
      items: [
        {
          eyebrow: "Capture",
          title: "Bring RSS feeds and saved pages into one entry point",
          description:
            "Subscriptions and saved URLs enter the same Markdown-oriented collection flow instead of living in disconnected apps."
        },
        {
          eyebrow: "Transform",
          title: "Turn captured content into editable Markdown drafts",
          description:
            "A saved page becomes a cleaner Markdown draft you can keep editing, restructuring and archiving."
        },
        {
          eyebrow: "Ship",
          title: "Keep writing, previewing and exporting in one workspace",
          description:
            "Draft, preview and export without jumping across separate tools for every stage of the workflow."
        }
      ]
    },
    features: {
      eyebrow: "Capabilities",
      title: "Core capabilities shaped around a Markdown workflow",
      description: "These capabilities are more useful together than alone.",
      items: [
        {
          title: "RSS subscription and archiving",
          description:
            "Bring ongoing reading sources into your local workspace so they can be filtered, read and archived over time."
        },
        {
          title: "Web page to Markdown",
          description: "Capture article content and turn it into editable Markdown with less cleanup."
        },
        {
          title: "Workspace terminal",
          description:
            "Keep a terminal inside the editor area and start it in the current workspace for command-line tasks."
        },
        {
          title: "Preview and presentation modes",
          description:
            "Switch between editing, preview, split view and presentation depending on what the content needs."
        },
        {
          title: "Multi-window and local workspaces",
          description:
            "Open different workspaces in separate windows so local file organization still matches how you work on desktop."
        },
        {
          title: "Multi-format export",
          description: "Export to HTML, PDF and long images without rebuilding the document elsewhere."
        },
        {
          title: "GitHub publishing",
          description: "Push notes to GitHub Issues and handle local asset uploads from the same workflow."
        },
        {
          title: "Shortcuts and desktop actions",
          description:
            "Shortcuts, file drag-and-drop, workspace operations and terminal toggles support a real desktop-first keyboard flow."
        }
      ]
    },
    desktopDetails: {
      eyebrow: "Desktop-native Details",
      title: "The details that make it feel like a real desktop workspace",
      description:
        "Beyond the main workflow, Zhiyuan also covers the smaller interactions that matter in everyday desktop use.",
      items: [
        {
          title: "Drag Markdown in and out",
          description:
            "Bring external Markdown files into the workspace, or drag notes back out to the system when needed."
        },
        {
          title: "Open Markdown directly from the OS",
          description:
            "Open a .md file or folder from the operating system and jump into the right workspace automatically."
        },
        {
          title: "Configurable shortcuts",
          description:
            "Terminal toggle, RSS import, note creation and mode switching all connect to a configurable shortcut system."
        },
        {
          title: "Workspace-based organization",
          description:
            "Recent workspaces, window binding, local file structure and multi-window behavior all follow how desktop users organize projects."
        }
      ]
    },
    usecase: {
      eyebrow: "Use Cases",
      label: "Case",
      title: "Built for people who genuinely work in Markdown",
      description: "It is not everything-for-everyone software, but it fits these users especially well.",
      items: [
        {
          title: "Continuous reading and clipping",
          description:
            "If you read RSS, save articles and keep excerpts, Zhiyuan helps move that material back into local Markdown."
        },
        {
          title: "Technical writing",
          description:
            "Draft blog posts, product documents and developer notes without rebuilding the same content in separate publishing tools."
        },
        {
          title: "Personal knowledge archiving",
          description: "Keep web pages, snippets, ideas and notes inside one Markdown-centered workspace."
        },
        {
          title: "Local-first writers",
          description:
            "If you care about file control, folder structure, keyboard flow, multi-window behavior and an embedded terminal, this workflow will feel more natural."
        }
      ]
    },
    cta: {
      eyebrow: "Get Started",
      title: "Start with Zhiyuan on GitHub",
      description:
        "Source, releases and future iterations already live on GitHub, so you can try the app first and follow the project in one place.",
      links: [
        {
          label: "GitHub Repository",
          href: "https://github.com/liwenka1/zhiyuan"
        },
        {
          label: "View Releases",
          href: "https://github.com/liwenka1/zhiyuan/releases"
        }
      ],
      platforms: ["Windows", "macOS", "Linux"]
    },
    footer: {
      tagline: "A local-first Markdown workspace",
      maintainer: {
        prefix: "Maintained by",
        name: "liwenka1",
        suffix: "",
        href: "https://github.com/liwenka1"
      },
      copyright: "© 2025 Zhiyuan Note"
    }
  }
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = (typeof translations)[Language];

export function getTranslations(language: Language): TranslationKey {
  return translations[language] as TranslationKey;
}
