<div align="center">
  <img src="apps/desktop/resources/icon.png" alt="Zhiyuan logo" width="96" height="96">
  <h1>Zhiyuan</h1>
  <p>
    <strong>A local-first Markdown workspace</strong>
    <br>
    Keep RSS, web capture, writing, preview, export and GitHub publishing inside one desktop workflow.
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
    <a href="https://zhiyuan.liwenkai.fun/">Website</a> •
    <a href="https://github.com/liwenka1/zhiyuan/releases">Releases</a> •
    <a href="README_zh.md">中文说明</a>
  </p>
</div>

---

## Overview

**Zhiyuan** is a Markdown-first desktop workspace built around local files and connected writing workflows. Instead of splitting capture, editing, preview, export and publishing across different tools, it keeps those steps inside one app.

- **Local-first**: your notes stay in local folders as native `.md` files
- **Markdown-centered**: collection, editing, preview and export all revolve around Markdown
- **Desktop-oriented**: multi-window workflows, workspace terminal, drag-and-drop and keyboard shortcuts feel at home on desktop

## Website

- Landing page: [zhiyuan.liwenkai.fun](https://zhiyuan.liwenkai.fun/)
- Releases: [GitHub Releases](https://github.com/liwenka1/zhiyuan/releases)
- Repository: [liwenka1/zhiyuan](https://github.com/liwenka1/zhiyuan)

## Highlights

| Feature | Description |
| :-- | :-- |
| **RSS feeds and archiving** | Pull reading sources into the local workspace for filtering, reading and long-term notes. |
| **Web page to Markdown** | Capture article content and convert it into editable Markdown drafts. |
| **Workspace terminal** | Open a terminal directly inside the current workspace while writing. |
| **Preview and presentation modes** | Switch between editing, preview, split view and presentation based on the task. |
| **Multi-window workspaces** | Open separate workspaces in different windows without losing a desktop-first workflow. |
| **Multi-format export** | Export to HTML, PDF and long images without rebuilding the document elsewhere. |
| **GitHub publishing** | Publish notes to GitHub Issues and handle local asset uploads in the same flow. |
| **Desktop-native interactions** | Support drag-and-drop, opening Markdown from the OS and configurable shortcuts. |

## Workflow

Zhiyuan is designed around a simple content loop:

1. **Collect**: subscribe to RSS or capture a web page into Markdown
2. **Write & run**: edit, preview, present and use a terminal in the same workspace
3. **Ship**: export to PDF, HTML or long image, or publish to GitHub

## Screenshots

### Dark Theme

<img src="apps/landing/public/screenshot-dark.png" alt="Zhiyuan dark theme screenshot">

### Light Theme

<img src="apps/landing/public/screenshot-light.png" alt="Zhiyuan light theme screenshot">

## Download

Download the latest build from [GitHub Releases](https://github.com/liwenka1/zhiyuan/releases).

| Platform | Package |
| :-- | :-- |
| **macOS** | `.dmg` |
| **Windows** | `.exe` |
| **Linux** | `.AppImage` / `.deb` |

### macOS note

Because the app is currently unsigned, macOS may show a damaged-app warning on first launch.

```bash
xattr -cr /Applications/纸鸢.app
```

Run the command above once, then open the app again.

## Local Development

### Requirements

- Node.js >= 18
- pnpm >= 8

### Install dependencies

```bash
pnpm install
```

### Start development

```bash
# Desktop app
pnpm dev:desktop

# Landing page
pnpm dev:landing
```

### Build

```bash
# Desktop app for current platform
pnpm build:desktop

# Desktop app for a specific platform
pnpm build:desktop:win
pnpm build:desktop:mac
pnpm build:desktop:linux

# Landing page
pnpm build:landing
```

### Useful checks

```bash
pnpm lint
pnpm typecheck
pnpm format:check
```

## License

[MIT](LICENSE)
