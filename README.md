<div align="center">
  <img src="apps/desktop/resources/icon.png" alt="纸鸢 Logo" width="96" height="96">
  <h1>纸鸢</h1>
  <p>
    <strong>优雅的 Markdown 桌面编辑器</strong>
    <br>
    专注写作，本地优先，支持多窗口、RSS 订阅、网页抓取与多格式导出
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
    <a href="#功能特性">功能特性</a> •
    <a href="#界面预览">界面预览</a> •
    <a href="#下载安装">下载安装</a> •
    <a href="#本地开发">本地开发</a>
  </p>
</div>

---

## 简介

**纸鸢**是一款轻量、美观的 Markdown 笔记应用，专为追求高效写作体验的用户设计。所有数据均存储在本地，以原生 `.md` 文件格式保存，你可以随时使用任何编辑器访问自己的笔记。

- **本地优先** — 数据完全属于你，无需登录，无需联网
- **文件即数据** — 标准 Markdown 格式，永不担心数据锁定
- **专注写作** — 简洁的界面，沉浸式的编辑体验

## 功能特性

| 功能                | 说明                                                   |
| :------------------ | :----------------------------------------------------- |
| **Markdown 编辑**   | 流畅的编辑体验，支持语法高亮和实时预览                 |
| **分栏 / 预览模式** | 编辑、预览、分栏三种模式自由切换                       |
| **演示模式**        | 全屏沉浸式展示笔记内容，适合阅读和分享                 |
| **多窗口**          | 支持同时打开多个窗口，独立管理不同工作区               |
| **URL 抓取**        | 输入网页链接，自动抓取内容生成 Markdown 笔记           |
| **RSS 订阅**        | 导入 RSS 源，自动抓取文章并转换为 Markdown 笔记        |
| **多格式导出**      | 支持导出 HTML、PDF、长图，支持分页导出                 |
| **主题切换**        | 浅色 / 深色主题，适配系统偏好                          |
| **多语言**          | 中文 / English 双语界面                                |
| **代码高亮**        | 支持多种编程语言语法高亮                               |
| **数学公式**        | 支持 LaTeX 数学公式渲染                                |
| **Mermaid 图表**    | 支持流程图、时序图等图表绘制                           |
| **目录导航**        | 自动提取标题生成可点击的目录                           |
| **全局搜索**        | 快速检索笔记内容                                       |
| **媒体内嵌**        | 支持音频、视频、图片直接内嵌                           |
| **跨平台**          | 支持 Windows、macOS、Linux                             |

## 界面预览

### 深色主题

<img src="assets/screenshot-dark.png" alt="深色主题">

### 浅色主题

<img src="assets/screenshot-light.png" alt="浅色主题">

## 下载安装

前往 [Releases 页面](https://github.com/liwenka1/zhiyuan/releases) 下载最新版本：

| 平台        | 安装包               |
| :---------- | :------------------- |
| **macOS**   | `.dmg`               |
| **Windows** | `.exe`               |
| **Linux**   | `.AppImage` / `.deb` |

### macOS 用户注意事项

由于应用未经过 Apple 签名认证，首次打开时可能会提示「已损坏」。

**解决方法：**

```bash
xattr -cr /Applications/纸鸢.app
```

运行上述命令后，再次打开应用即可正常使用。

## 本地开发

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 启动开发服务

```bash
# 启动桌面应用
pnpm dev:desktop
```

### 构建应用

```bash
# 构建当前平台
pnpm build:desktop

# 构建指定平台
pnpm build:desktop:win    # Windows
pnpm build:desktop:mac    # macOS
pnpm build:desktop:linux  # Linux
```

## License

[MIT](LICENSE)
