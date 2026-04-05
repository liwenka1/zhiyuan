<div align="center">
  <img src="apps/desktop/resources/icon.png" alt="纸鸢 Logo" width="96" height="96">
  <h1>纸鸢</h1>
  <p>
    <strong>本地优先的 Markdown 工作台</strong>
    <br>
    把 RSS、网页抓取、写作、预览、导出和 GitHub 发布收进同一条桌面工作流。
  </p>
  <p>
    <a href="https://github.com/liwenka1/zhiyuan/releases">
      <img src="https://img.shields.io/github/v/release/liwenka1/zhiyuan?style=flat-square" alt="Release">
    </a>
    <a href="https://github.com/liwenka1/zhiyuan/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/liwenka1/zhiyuan?style=flat-square" alt="License">
    </a>
    <img src="https://img.shields.io/badge/-macOS-black?style=flat-square&logo=apple&logoColor=white" alt="macOS">
    <img src="https://img.shields.io/badge/-Windows-blue?style=flat-square&logo=windows&logoColor=white" alt="Windows">
    <img src="https://img.shields.io/badge/-Linux-333?style=flat-square&logo=linux&logoColor=white" alt="Linux">
  </p>
  <p>
    <a href="https://zhiyuan.liwenkai.fun/">官网</a> •
    <a href="https://github.com/liwenka1/zhiyuan/releases">Releases</a> •
    <a href="README.md">English</a>
  </p>
</div>

---

## 简介

**纸鸢**是一款围绕本地文件和 Markdown 工作流构建的桌面应用。它希望把采集、编辑、预览、导出和发布这些原本分散在不同工具里的动作，重新收拢到一个更连贯的桌面工作区里。

- **本地优先**：笔记保存在本地文件夹中，以原生 `.md` 文件存在
- **Markdown-first**：采集、编辑、预览和导出都围绕 Markdown 展开
- **桌面工作流**：多窗口、工作区终端、拖拽和快捷键更符合桌面使用习惯

## 官网与链接

- 官网：[zhiyuan.liwenkai.fun](https://zhiyuan.liwenkai.fun/)
- 下载：[GitHub Releases](https://github.com/liwenka1/zhiyuan/releases)
- 仓库：[liwenka1/zhiyuan](https://github.com/liwenka1/zhiyuan)

## 核心能力

| 功能 | 说明 |
| :-- | :-- |
| **RSS 订阅与归档** | 把持续阅读的信息源拉回本地工作区，便于筛选、阅读和沉淀。 |
| **网页转 Markdown** | 抓取正文并转换成可继续编辑的 Markdown 草稿。 |
| **工作区终端** | 在当前工作区里直接打开终端，边写边处理命令行任务。 |
| **预览与演示模式** | 在编辑、预览、分栏和演示之间切换，覆盖不同使用场景。 |
| **多窗口工作区** | 在不同窗口中打开不同工作区，保持桌面式组织方式。 |
| **多格式导出** | 支持导出 HTML、PDF 和长图。 |
| **GitHub 发布** | 可把笔记发布到 GitHub Issue，并处理本地资源上传。 |
| **桌面原生交互** | 支持拖拽、从系统直接打开 Markdown、可配置快捷键等能力。 |

## 工作流

纸鸢的整体思路可以概括成一条简单链路：

1. **Collect**：订阅 RSS 或抓取网页，把内容先带回本地 Markdown 工作区
2. **Write & run**：在同一个界面里继续写作、预览、演示和打开终端
3. **Ship**：导出为 PDF、HTML、长图，或发布到 GitHub

## 界面预览

### 深色主题

<img src="apps/landing/public/screenshot-dark.png" alt="纸鸢深色主题截图">

### 浅色主题

<img src="apps/landing/public/screenshot-light.png" alt="纸鸢浅色主题截图">

## 下载

前往 [GitHub Releases](https://github.com/liwenka1/zhiyuan/releases) 下载最新版本。

| 平台 | 安装包 |
| :-- | :-- |
| **macOS** | `.dmg` |
| **Windows** | `.exe` |
| **Linux** | `.AppImage` / `.deb` |

### macOS 注意事项

由于应用当前未签名，首次打开时 macOS 可能会提示应用“已损坏”。

```bash
xattr -cr /Applications/纸鸢.app
```

执行一次上面的命令后，再重新打开应用即可。

## 本地开发

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 启动开发

```bash
# 桌面应用
pnpm dev:desktop

# Landing 页面
pnpm dev:landing
```

### 构建

```bash
# 构建当前平台桌面应用
pnpm build:desktop

# 构建指定平台桌面应用
pnpm build:desktop:win
pnpm build:desktop:mac
pnpm build:desktop:linux

# 构建 Landing 页面
pnpm build:landing
```

### 常用检查

```bash
pnpm lint
pnpm typecheck
pnpm format:check
```

## License

[MIT](LICENSE)
