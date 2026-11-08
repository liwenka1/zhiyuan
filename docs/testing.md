# 测试与发布门禁

项目把测试分成几层，每层解决不同问题：

- `pnpm test:core`：安全策略和关键源码约束的快速门禁。它保留静态断言，不能替代运行时测试。
- `pnpm test:unit`：运行时行为测试。目前覆盖持久化队列、工作区扫描、文件监听、配置回滚和窗口关闭握手。
- `pnpm typecheck:tests`：单独检查测试源码，避免测试本身因为类型错误失效。
- `pnpm test:unit:coverage`：生成 V8 覆盖率文本、JSON 摘要和 HTML 报告。当前先报告，不设置全局阈值。
- `pnpm verify:desktop-build`：确认 main、preload、renderer 入口和应用版本都存在且有效。
- `pnpm smoke:desktop`：在已构建的产物上启动 Electron，并确认 renderer 完成首屏加载。
- `pnpm build:desktop`：执行桌面端类型检查和生产构建。

新增涉及持久化、文件系统、工作区切换、IPC 或窗口生命周期的代码时，应优先补运行时行为测试；只有输入策略或源码结构约束才使用 `test:core` 的静态检查。

CI 在构建前执行类型检查、Lint、格式检查、核心安全测试、运行时测试、测试类型检查和覆盖率报告，并保存覆盖率 artifact。桌面构建完成后会校验产物结构，并在 Linux `xvfb` 环境执行启动冒烟；发布 workflow 也会执行同一份产物校验。

当前仍需要后续补充跨平台核心流程 E2E；现阶段启动冒烟只覆盖 Linux `xvfb`，不把未稳定的图形交互测试作为所有 Pull Request 的硬门禁。
