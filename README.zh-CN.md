# Latte Engine

<p align="center">
  <strong>面向 Web 的可编程图形编辑器引擎。</strong><br>
  <em>Figma 级画布语义 · VSCode 风格扩展平台 · Worker 优先架构</em>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./docs/roadmap.zh-CN.md">RoadMap</a> ·
  <a href="./docs/architecture-blueprint.zh-CN.md">架构蓝图</a> ·
  <a href="./CONTRIBUTING.zh-CN.md">贡献指南</a>
</p>

## 当前状态

Latte 仍处于 1.0 之前。当前重点是编辑器内核：共享内存数据布局、worker 侧权威写入、主线程只读渲染投影、变换数学、事务/历史边界，以及开源项目治理。

## 愿景

Latte 目标是成为一个设计编辑器平台，结合：

- Figma 类画布编辑：高性能图层、变换、布局、组件、变量、检查与导出。
- VSCode 类平台架构：服务、命令、快捷键、上下文、贡献点、配置和插件运行时。
- 面向未来的 native 性能路线：Rust/WASM 内核可在不破坏 worker/service 边界的前提下承接几何、存储、snapshot/diff 与 replay 热路径。
- 适合商业化的开源策略：monorepo 采用包级许可证，核心/产品包使用 AGPL + 商业授权，协议/SDK/基础设施包保持宽松协议。

## 架构

Latte 使用 pnpm/Turborepo monorepo，并采用 worker 优先的编辑模型：

```text
UI / Tool / Command / Plugin
  -> 主线程 service facade
  -> RPC
  -> worker service
  -> MutationGate
  -> System / Manager
  -> NodeCursor
  -> SharedArrayBuffer / SoA
  -> renderer 和 UI 只读投影
```

| 包                   | 角色           | 职责                                                                                      |
| -------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `@latte-js/bean`     | 协议层         | 类型、节点枚举、文件 schema 类型与 RPC contract。                                         |
| `@latte-js/espresso` | 数据内核       | `SharedArrayBuffer`、SoA 布局、SceneGraph、NodeCursor、loader/serializer 与临时 shared heap/blob 存储。 |
| `@latte-js/barista`  | Worker 引擎    | Worker services、systems、mutation policy、事务、历史、undo/redo 与未来 Rust/WASM 计算桥接。 |
| `@latte-js/crema`    | Runtime 组装   | Editor runtime、worker client、projection sync 与 interaction controller。                |
| `@latte-js/art`      | 渲染层         | 只读 renderer、camera、hit test、RTree 与 render backends。                               |
| `@latte-js/syrup`    | 主线程平台     | Editor host、DI、commands、menus、keybindings、input 与未来 contribution registry。       |
| `@latte-js/counter`  | Workbench 贡献 | 内置工具、selection、commands 与产品行为。                                                |
| `@latte-js/milk`     | UI 层          | 通过 service 操作的 React 面板与 UI 组件。                                                |
| `@latte-js/kit`      | 工具包         | Events、lifecycle、平台工具与共享数据结构。                                               |
| `apps/cafe`          | 示例应用       | 集成示例、本地 smoke target 与产品 playground。                                           |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm 10.x，与根 `package.json` 的 `packageManager` 字段保持一致

### 安装运行

```bash
git clone https://github.com/DrugsZ/Latte.git
cd Latte
pnpm install
pnpm build
pnpm dev
```

打开 `http://localhost:5173`。

### 常用命令

```bash
pnpm release:check
```

`pnpm release:check` 会执行本地 release gate：许可证元数据、lint、type-check、单元测试、`apps/cafe` 构建、Playwright 浏览器准备、smoke/e2e，以及 `git diff --check`。

## RoadMap

详版计划见 [docs/roadmap.zh-CN.md](./docs/roadmap.zh-CN.md)。

- P0：稳定内核、投影、变换、历史边界与发布门禁。
- P1：补齐 projection 一致性、shared metadata、style/node/query services 与结构历史。
- P2：实现 Figma 对齐的几何与布局语义：constraints、auto layout、group auto-bounds。
- P3：建设 VSCode 风格平台能力：context keys、configuration、contribution registry、plugin manifest。
- P4：补齐设计语义：components、instances、variants、variables、styles、text/vector 与 libraries。
- P5：引入 extension host、插件公开 API、权限和运行时校验。
- P6：补齐 Dev Mode、inspect、codegen、export 与 headless automation。
- P7：推进协同、版本历史、生产部署与性能基线。
- P8：评估 Rust/WASM native kernel，承接被性能基线证明必要的存储与几何热路径。

## 文档

- [架构蓝图](./docs/architecture-blueprint.zh-CN.md)
- [详细 RoadMap](./docs/roadmap.zh-CN.md)
- [Figma layout/resize 计划](./docs/figma-layout-resize-plan.zh-CN.md)
- [工程治理与许可证策略](./docs/governance-and-licensing.zh-CN.md)
- [贡献指南](./CONTRIBUTING.zh-CN.md)

## 贡献

提交 PR 前请阅读 [CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md)。最重要的架构规则是：document model 写入必须经过 worker 侧 services/systems 和 `NodeCursor`；renderer 与 UI 只读 projection，不直接修改模型。

## 许可证

本 monorepo 采用包级许可证。二次分发前请以各包 `package.json` 与 `LICENSE` 为准。

| 范围                 | 包                                               | 许可证                              |
| -------------------- | ------------------------------------------------ | ----------------------------------- |
| 核心/产品包          | `espresso`、`barista`、`crema`、`art`、`counter` | `AGPL-3.0-or-later`，可提供商业授权 |
| 协议/SDK/UI 基础设施 | `bean`、`kit`、`syrup`、`milk`                   | `MIT`                               |
| 示例应用             | `apps/cafe`                                      | `UNLICENSED`，不作为可复用包发布    |

如需在不承担 AGPL 义务的情况下用于商业产品，请联系维护者获取商业授权。
