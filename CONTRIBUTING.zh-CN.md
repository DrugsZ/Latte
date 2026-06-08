# Latte 贡献指南

感谢你帮助改进 Latte。项目目前仍处于 1.0 之前，所以架构一致性和功能完成度同样重要。

## 项目结构

Latte 是 pnpm/Turborepo monorepo。关键包如下：

| 包                   | 职责                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| `@latte-js/bean`     | 共享类型、文件 schema 类型与 RPC contracts。                              |
| `@latte-js/espresso` | 共享内存数据内核、SceneGraph、SoA 布局与 NodeCursor。                     |
| `@latte-js/barista`  | Worker 侧 services、systems、mutation policy、事务与历史。                |
| `@latte-js/crema`    | Runtime 组装、worker client、projection sync 与 interaction controllers。 |
| `@latte-js/art`      | 只读 renderer、camera 与 hit testing。                                    |
| `@latte-js/syrup`    | 主线程平台服务：DI、commands、menus、keybindings 与 input。               |
| `@latte-js/counter`  | 内置 workbench contributions、tools 与 selection state。                  |
| `@latte-js/milk`     | React UI 组件与面板。                                                     |
| `@latte-js/kit`      | 共享运行时工具。                                                          |

## 环境搭建

```bash
pnpm install
pnpm build
pnpm dev
```

打开 `http://localhost:5173` 查看示例应用。

## 架构规则

### 1. 依赖方向

保持包依赖有意且无环。底层包不能导入产品/UI 包。

期望流向：

```text
apps/cafe
  -> crema / counter / milk / art
  -> syrup / barista
  -> espresso
  -> bean
```

### 2. Worker 权威写入

Document model 写入最终必须进入 worker 侧路径：

```text
main-thread service facade
  -> RPC
  -> worker service
  -> MutationGate
  -> System / Manager
  -> NodeCursor
  -> SharedArrayBuffer / SoA
```

Renderer、React 组件和主线程 workbench 代码只读 projection 与 session state，不能直接修改 document data。

### 3. NodeCursor 是 mutation gateway

业务 mutation 应通过 `NodeCursor`，这样 mutation records、dirty flags、observers 和 history 才能保持一致。直接 typed-array 访问仅限 Espresso 底层 ops 和经过审查的内部代码。

### 4. Mutation policy 与事务

不要让主线程调用方手动打开事务。Worker services/systems 需要声明 mutation policy，由 `MutationGate` 自动处理事务边界。

常见策略包括：

- `readonly`
- `writeNoHistory`
- `atomic`
- `sessionBegin`
- `sessionMutation`
- `sessionCommit`
- `sessionCancel`
- `manual`

如果某个 service method 会写 document data，它必须有明确 policy 和测试。

### 5. Transaction 与 History 分离

- `TransactionManager` 记录单次编辑的生命周期。
- `HistoryManager` 拥有 undo/redo 栈与 inverse replay。
- `UndoRedoService` 提供面向用户的 undo/redo 入口。

Undo/redo replay 应复用同一 mutation application 路径，不应直接写 raw SAB 字段。

### 6. Transform 与 Layout 分离

自由变换属于 transform systems。Frame resize、constraints、auto layout 与 group auto-bounds 属于 layout systems/services。

详见 [docs/figma-layout-resize-plan.zh-CN.md](./docs/figma-layout-resize-plan.zh-CN.md)。

### 7. 运行时校验只放在边界

Runtime schema validation 适合文件导入、插件 manifest、external commands、RPC payloads 和配置。不应把重校验放进 NodeCursor、SoA hot path、matrix/AABB tick 或 renderer loop。

## 开发流程

添加功能时：

1. 如果功能跨包或跨 RPC 边界，先在 `@latte-js/bean` 定义共享类型。
2. 如果数据属于 document model，再在 `@latte-js/espresso` 增加存储支持。
3. 权威写入或重计算放在 `@latte-js/barista` 的 worker service/system。
4. 主线程需要调用 worker-backed service 时，在 `@latte-js/crema` 做 runtime wiring。
5. 内置工具/命令行为放在 `@latte-js/counter`。
6. 渲染和 hit-test 行为放在 `@latte-js/art`。
7. UI 放在 `@latte-js/milk`。
8. 同一 PR 更新对应文档和测试。

## 测试

开发时优先跑相关包检查：

```bash
pnpm --filter @latte-js/espresso test
pnpm --filter @latte-js/barista test
pnpm --filter @latte-js/crema test
pnpm --filter @latte-js/cafe build
```

提交 PR 前，根据改动范围运行发布门禁：

```bash
pnpm release:check
```

几何改动应测试 rendered/world-space 结果，而不只检查 local matrix 字段。

## 文档

修改架构、公共 API、包边界、许可证策略或贡献流程时，需要同步更新文档。

重要文档：

- [README.zh-CN.md](./README.zh-CN.md)
- [docs/roadmap.zh-CN.md](./docs/roadmap.zh-CN.md)
- [docs/architecture-blueprint.zh-CN.md](./docs/architecture-blueprint.zh-CN.md)
- [docs/governance-and-licensing.zh-CN.md](./docs/governance-and-licensing.zh-CN.md)

## Pull Request

- PR 应聚焦、可 review。
- 尽量使用 Conventional Commits，例如 `feat: add transform target tests`。
- 行为变更需要测试。
- 架构边界变化需要在 PR 描述中说明。
- 不要格式化无关文件。
- 不要提交生成报告、本地缓存或构建产物，除非它们本来就是有意跟踪的文件。

## 许可证与商业化

Latte 使用包级许可证。核心/产品包为 `AGPL-3.0-or-later`，可提供商业授权；协议/SDK/UI 基础设施包当前为 `MIT`。

外部贡献在进入商业双授权版本前，可能需要 CLA 或等效贡献者授权。这里不是法律意见；正式 1.0 前维护者应让专业律师确认最终策略。

## 反馈问题

报告 bug 时请包含：

- 操作系统和浏览器。
- Node/pnpm 版本。
- 复现步骤。
- 预期行为和实际行为。
- 可用时附上 console/page errors。

提出功能建议时，请说明用户工作流、为什么重要，以及它影响 Figma 类编辑语义、VSCode 类平台 API，还是两者都影响。
