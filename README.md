# 纸鸢笔记 Monorepo

优雅的 Markdown 编辑器 + Landing 页

## 📁 项目结构

```
zhiyuan/
├── apps/
│   ├── desktop/          # Electron 桌面应用
│   └── landing/          # Next.js Landing 页
├── package.json          # 根 package.json
├── pnpm-workspace.yaml   # pnpm workspace 配置
└── turbo.json           # Turborepo 配置
```

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 启动 Desktop 应用
pnpm dev:desktop

# 启动 Landing 页
pnpm dev:landing
```

### 构建

```bash
# 构建 Desktop 应用
pnpm build:desktop

# 构建 Landing 页
pnpm build:landing

# 构建 Desktop 应用（特定平台）
pnpm build:desktop:win    # Windows
pnpm build:desktop:mac    # macOS
pnpm build:desktop:linux  # Linux
```

### 代码检查

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Format
pnpm format
```

## 📦 Desktop 应用

基于 Electron + Vite + React 构建的桌面应用。

**技术栈：**

- Electron 38
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui

**目录：** `apps/desktop/`

## 🌐 Landing 页

基于 Next.js 构建的产品 Landing 页。

**技术栈：**

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

**目录：** `apps/landing/`

**本地预览：** http://localhost:3000

## 📥 下载使用

### Desktop 应用下载

前往 [Releases 页面](https://github.com/liwenka1/zhiyuan/releases) 下载最新版本：

- **macOS**: 下载 `.dmg` 文件
- **Windows**: 下载 `.exe` 文件
- **Linux**: 下载 `.AppImage` 或 `.deb` 文件

### macOS 用户注意事项

由于应用未经过 Apple 签名认证，首次打开时可能会提示"已损坏"。

**解决方法：**

1. 打开"终端"应用
2. 运行以下命令：
   ```bash
   xattr -cr /Applications/纸鸢.app
   ```
3. 再次打开应用即可正常使用

这是 macOS 对未签名应用的安全限制，属于正常现象。

## 🚢 部署

### Desktop 应用

使用 GitHub Actions 自动构建和发布：

1. 推送 tag（如 `v1.0.0`）触发构建
2. 自动构建 Windows、macOS、Linux 版本
3. 发布到 GitHub Releases

### Landing 页

**Vercel 部署（推荐）：**

1. 在 Vercel 导入项目
2. 设置 Root Directory: `apps/landing`
3. 自动检测 Next.js 配置
4. 推送到 main 分支自动部署

**配置：**

- Framework Preset: Next.js
- Root Directory: `apps/landing`
- Build Command: `pnpm build`
- Output Directory: `.next`

## 📝 开发注意事项

1. **pnpm workspace**：使用 pnpm workspace 管理 monorepo
2. **Turbo**：使用 Turborepo 加速构建
3. **共享配置**：Prettier、ESLint 配置在根目录
4. **独立依赖**：每个 app 有自己的 `node_modules`

## 🔧 常用命令

```bash
# 只为 desktop 安装依赖
pnpm --filter desktop install

# 只为 landing 安装依赖
pnpm --filter landing install

# 为所有项目运行命令
pnpm -r <command>

# 清理所有 node_modules
rm -rf node_modules apps/*/node_modules

# 重新安装
pnpm install
```

## 📄 License

MIT
