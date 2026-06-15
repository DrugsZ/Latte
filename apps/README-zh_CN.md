# Latte Apps

本目录包含 Latte monorepo 的示例应用与产品集成入口。

## 当前应用

| 应用   | 用途                                                                                       | 包名             |
| ------ | ------------------------------------------------------------------------------------------ | ---------------- |
| `cafe` | 用于验证 editor runtime、renderer、worker pipeline 与 UI shell 的集成示例和 smoke target。 | `@latte-js/cafe` |

本目录下的应用不作为可复用包发布。可复用代码应放在 `packages/*`。

## 开发

在仓库根目录运行：

```bash
pnpm install
pnpm build
pnpm dev
```

打开 `http://localhost:5173`。

常用应用检查：

```bash
pnpm --filter @latte-js/cafe build
pnpm e2e
```

## SharedArrayBuffer 要求

Latte 依赖 `SharedArrayBuffer`。本地预览和部署环境都需要设置 COOP/COEP headers，让页面处于 cross-origin isolated 状态。`cafe` 的 Vite 配置是本地开发的参考实现。

## 贡献

请阅读 [../CONTRIBUTING.zh-CN.md](../CONTRIBUTING.zh-CN.md)。应用层负责组装包和演示工作流，不应承载核心引擎行为。

## 许可证

本目录下应用主要作为演示和产品集成入口。`apps/cafe` 为 `UNLICENSED` 且私有；可复用包的许可证以 `packages/*` 内各包为准。
