export const translations = {
  zh: {
    header: {
      features: "功能",
      usecase: "使用场景",
      download: "下载"
    },
    hero: {
      title: "纸鸢笔记",
      description: "优雅的 Markdown 编辑器，让写作更专注",
      download: "立即下载",
      learnMore: "了解更多"
    },
    features: {
      title: "核心功能",
      description: "为写作者精心打造的功能，让你专注于内容创作",
      items: [
        {
          title: "实时预览",
          description: "所见即所得的 Markdown 编辑体验，边写边看效果"
        },
        {
          title: "多格式导出",
          description: "支持导出 PDF、HTML、图片等多种格式"
        },
        {
          title: "跨平台支持",
          description: "支持 Windows、macOS、Linux 三大平台"
        },
        {
          title: "本地优先",
          description: "数据存储在本地，保护你的隐私安全"
        },
        {
          title: "快捷操作",
          description: "丰富的快捷键支持，提升写作效率"
        },
        {
          title: "主题切换",
          description: "支持浅色和深色主题，适应不同使用场景"
        }
      ]
    },
    usecase: {
      title: "使用场景",
      description: "无论你是开发者、学生还是写作爱好者，都能找到适合的使用方式",
      items: [
        {
          title: "技术博客",
          description: "支持代码高亮和数学公式，是技术写作的理想工具"
        },
        {
          title: "学习笔记",
          description: "快速记录学习内容，支持标签分类和全文搜索"
        },
        {
          title: "项目文档",
          description: "编写项目文档和 README，支持多种导出格式"
        },
        {
          title: "日常记录",
          description: "记录生活点滴，简洁的界面让你专注于内容"
        }
      ]
    },
    cta: {
      title: "开始使用纸鸢笔记",
      description: "选择适合你的平台，立即下载体验",
      windows: "Windows",
      macos: "macOS",
      linux: "Linux"
    },
    footer: {
      copyright: "© 2025 纸鸢笔记. All rights reserved.",
      github: "GitHub",
      docs: "文档",
      feedback: "反馈"
    }
  },
  en: {
    header: {
      features: "Features",
      usecase: "Use Cases",
      download: "Download"
    },
    hero: {
      title: "Zhiyuan Note",
      description: "An elegant Markdown editor for focused writing",
      download: "Download Now",
      learnMore: "Learn More"
    },
    features: {
      title: "Core Features",
      description: "Carefully crafted features for writers to focus on content creation",
      items: [
        {
          title: "Live Preview",
          description: "WYSIWYG Markdown editing experience, see results as you write"
        },
        {
          title: "Multi-format Export",
          description: "Export to PDF, HTML, images and more"
        },
        {
          title: "Cross-platform",
          description: "Support for Windows, macOS, and Linux"
        },
        {
          title: "Local First",
          description: "Data stored locally to protect your privacy"
        },
        {
          title: "Quick Actions",
          description: "Rich keyboard shortcuts to boost writing efficiency"
        },
        {
          title: "Theme Switching",
          description: "Support light and dark themes for different scenarios"
        }
      ]
    },
    usecase: {
      title: "Use Cases",
      description: "Whether you're a developer, student, or writing enthusiast, find your perfect use case",
      items: [
        {
          title: "Tech Blog",
          description: "Code highlighting and math formulas support, ideal for technical writing"
        },
        {
          title: "Study Notes",
          description: "Quick note-taking with tag classification and full-text search"
        },
        {
          title: "Project Docs",
          description: "Write project documentation and README with multiple export formats"
        },
        {
          title: "Daily Journal",
          description: "Record life moments with a clean interface focused on content"
        }
      ]
    },
    cta: {
      title: "Get Started with Zhiyuan Note",
      description: "Choose your platform and download now",
      windows: "Windows",
      macos: "macOS",
      linux: "Linux"
    },
    footer: {
      copyright: "© 2025 Zhiyuan Note. All rights reserved.",
      github: "GitHub",
      docs: "Docs",
      feedback: "Feedback"
    }
  }
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = (typeof translations)[Language];
