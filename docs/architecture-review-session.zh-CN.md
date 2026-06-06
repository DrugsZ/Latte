# Latte 架构评审记录

本文档汇总了当前评审/实现会话中完成的架构变更，
用于代码评审时的引导式检查清单。

## 目标方向

当前架构方向如下：

```txt
主线程
  VSCode 风格的服务、命令、键绑定、工具
    -> 类型化 RPC 服务，例如 NodeService / TransformService
       / UndoRedoService

Worker
  领域服务
    -> systems
    -> NodeCursor / SceneGraph 写屏障
    -> TransactionManager 事务记录
    -> HistoryManager undo/redo 栈
    -> dirty pipeline

Render
  基于 SharedArrayBuffer 的只读投影
```

主线程应保留语义化 API，不应将原始 mutation action bus
作为主要编程模型。

## 评审顺序

1. 评审 `packages/espresso` 中的数据边界。
2. 评审 `packages/barista` 中 worker 的事务与历史行为。
3. 评审 `packages/crema` 中的运行时编排。
4. 评审 `apps/cafe` 中的应用集成。
5. 评审测试与 e2e 覆盖。

## 数据层：`packages/espresso`

### 共享内存与元数据

SoA 布局已扩展，使渲染元数据可以驻留在共享内存中：

- `packages/espresso/src/data/memoryLayout.ts`
- `packages/espresso/src/data/sceneGraph.ts`
- `packages/espresso/src/data/heapManager.ts`
- `packages/espresso/src/data/blobManager.ts`
- `packages/espresso/src/data/ops/styleOps.ts`

这支持了 worker 侧加载、主线程只读投影的模型，可承载名称、填充、描边及相关渲染元数据。

### 防御式 SAB 初始化

`SceneGraph` 现在会对空的外部 buffer 进行防御式初始化，
使层级列使用 `NULL_INDEX`，避免意外的零值。
这可防止在挂接外部创建的 SharedArrayBuffer 时出现 root 自环。

评审点：

- `packages/espresso/src/data/sceneGraph.ts`
- `packages/espresso/src/data/__test__/sceneGraph.test.ts`

### 写屏障与变更记录

`NodeCursor` 现在是用户可编辑属性的主要写屏障。
它会在应用写入后、标记 dirty 前记录 mutation。

新类型：

- `packages/espresso/src/data/mutationRecorder.ts`

集成点：

- `SceneGraph.setMutationRecorder(...)`
- `SceneGraph.recordMutation(...)`
- `NodeCursor._mutate(...)`
- `NodeCursor.appendChild(...)`
- `NodeCursor.removeChild(...)`
- `NodeCursor.delete(...)`

记录结构如下：

```ts
{
  id,
  index,
  prop,
  oldValue,
  newValue,
  dirtyFlag
}
```

关键边界：

- 通过 `NodeCursor` 产生的用户编辑可被记录。
- `worldMatrix` 与 `aabb` 等派生流水线写入仍使用底层操作，不应进入 undo/redo 历史。

测试：

- `packages/espresso/src/data/__test__/nodeCursor.test.ts`

## Worker 层：`packages/barista`

### Transaction Manager / History Manager

`TransactionManager` 只负责当前事务生命周期：

- `begin` / `capture` / `recordMutation`
- `commit` 产出 committed transaction records
- `abort` 使用 inverse records 回滚当前事务

它实现了 `IMutationRecorder`，在事务激活时接收 `NodeCursor` 的 mutation 记录，
但不再保存 undo/redo 栈。

`HistoryManager` 负责历史状态：

- 保存 undo/redo stack
- 接收 `TransactionManager.commit()` 产出的 committed transaction
- 生成 inverse records
- 调用 `MutationRecordApplier` 统一回放

`MutationRecordApplier` 是 undo/redo 与事务 abort 的统一写回入口。
它使用 `NodeCursor` / `SceneGraph` 写屏障应用 `INodeMutationRecord`，
避免历史回放走另一套直接写 SAB 的维护路径。

评审点：

- `packages/barista/src/transactions/transactionManager.ts`
- `packages/barista/src/history/historyManager.ts`
- `packages/barista/src/history/mutationRecordApplier.ts`
- `packages/barista/src/transactions/__test__/transactionManager.test.ts`
- `packages/barista/src/history/__test__/historyManager.test.ts`

提交行为：

```txt
active records
  -> 克隆 forward records
  -> 返回 committed transaction
  -> MutationGate 推入 HistoryManager
```

撤销行为：

```txt
HistoryManager 弹出 undo entry
  -> MutationRecordApplier 回放 inverse records
  -> 将 entry 压入 redo 栈
```

重做行为：

```txt
HistoryManager 弹出 redo entry
  -> MutationRecordApplier 回放 forward records
  -> 将 entry 压入 undo 栈
```

当前回放支持覆盖常见 `NodeCursor` 可编辑属性：

- 变换：`x`、`y`、`width`、`height`、`transform`
- 样式：fills、strokes、opacity、visibility、stroke 设置、radius
- 元数据：name、locked
- 层级父子关系变更（当前存在同级顺序限制）

当前限制：

- `removeSelf` 的可逆回放仍需要序列化节点快照。
  在快照实现前，`SceneGraph.deleteNode()`/`NodeCursor.delete()` 会在
  history mutation scope 中修改数据前抛错，避免生成无法 undo/redo 的
  history journal；`MutationRecordApplier` 回放分支仍保留防御性错误。

### 内部 Transaction Registry 与 Undo/Redo 服务

`TransactionManager` 与 `HistoryManager` 通过弱引用注册表按 `SceneGraph`
共享。这样所有 worker 服务都能参与同一活跃事务和同一历史栈。
它们是 worker 内部基础设施，不作为主线程或插件可直接调用的 RPC。

评审点：

- `packages/barista/src/transactions/mutationPolicy.ts`
- `packages/barista/src/transactions/transactionRegistry.ts`
- `packages/barista/src/ipc/proxyChannel.ts`
- `packages/barista/src/ipc/channelServer.ts`
- `packages/barista/src/services/serviceBase.ts`
- `packages/barista/src/systems/systems.ts`
- `packages/barista/src/services/undoRedo.ts`
- `packages/bean/src/rpc/undoRedo.ts`

公开服务边界：

- `UndoRedoService`：`undo`、`redo`、`canUndo`、`canRedo`

RPC/service dispatcher 通过 `MutationGate` 统一拥有事务边界。
Service 与 System 在注册时通过 `@service({ mutations: ... })` 或
`@system({ mutations: ... })` 声明方法策略。Service 级策略优先；
如果没有声明，则 fallback 到同名 System 的策略。单次语义 RPC，
例如 `TransformService.moveBy(...)`，会自动包进 worker 事务。
连续交互使用领域 session，例如 `TransformService.beginTransform(...)`、
`commitTransform()`、`cancelTransform()`；这些是变换交互 API，
不是通用事务 API。

这样可以避免插件或主线程代码直接调用危险的 `begin/commit/abort`
原语。重命名、样式修改、节点移动，或未来的增删 API 都应遵循同一模式：
对外暴露语义 RPC，声明 mutation policy，然后由 dispatcher 包裹实际
`NodeCursor` 写入。

当前 policy kind 覆盖 `readonly`、`writeNoHistory`、`manual`、`atomic`、
`sessionBegin`、`sessionMutation`、`sessionCommit`、`sessionCancel` 与
`history`。其中 `manual` 留给复杂方法在 worker 内部细粒度控制
`TransactionManager`，但仍不向主线程暴露通用事务 API。

`ChannelServer` 现在顺序处理消息。这样可以避免多个文档或协作者几乎同时
发送 RPC 时，active graph session 切换与写事务发生交错。

测试：

- `packages/barista/src/ipc/__test__/channelServer.test.ts`
- `packages/barista/src/services/__test__/serviceMutationPolicy.test.ts`
- `packages/barista/src/services/__test__/transformServiceTransactions.test.ts`

### Transform System 与服务

`TransformSystem` 现在仅暴露变换相关的领域行为。
它可以读取活跃事务快照以保持拖拽增量稳定，
但不再负责事务生命周期或 undo/redo。

评审点：

- `packages/barista/src/systems/transform.ts`
- `packages/barista/src/services/transform.ts`
- `packages/bean/src/rpc/transform.ts`

测试：

- `packages/barista/src/systems/__test__/transformSystem.test.ts`

### 已移除 Mutation RPC

公开的 `MutationService` / `MutationOperation` / `Channels.Mutation` 路径已移除。

原因：

- 主线程应保持 VSCode 风格，使用类型化语义服务 RPC。
- 原始 mutation 操作是内部日志关注点，不应成为公开编程模型。

已删除文件：

- `packages/barista/src/services/mutation.ts`
- `packages/barista/src/services/__test__/mutationService.test.ts`
- `packages/bean/src/rpc/mutation.ts`

请确认无残留引用：

```sh
rg -n "MutationService|IMutationService|MutationOperation|Channels\.Mutation|mutationService|rpc/mutation|services/mutation" packages apps
```

## 运行时层：`packages/crema`

`@latte-js/crema` 已作为编辑器运行时编排包新增。

评审点：

- `packages/crema/package.json`
- `packages/crema/src/editorRuntime.ts`
- `packages/crema/src/interactions/runtimeInteractionController.ts`
- `packages/crema/src/interactions/__test__/runtimeInteractionController.test.ts`

职责：

- 启动编辑器
- 注册渲染桥接
- 通过 worker 加载文档
- 暴露交互辅助能力
- 释放渲染器与监听器

`RuntimeInteractionController` 使用类型化服务协调主线程编辑流程。
变换交互生命周期委托给 `TransformService`，历史控制使用
`UndoRedoService`。

拖拽期间：

```txt
moveBy(...)
  -> 合并（coalesced）的 requestAnimationFrame 更新
  -> transformService.moveBy$ 通知
```

提交期间：

```txt
先通过 transformService.moveBy request 刷新待处理更新
  -> transformService.commitTransform
```

历史辅助方法现在委托给 `UndoRedoService`：

- `undo`
- `redo`
- `canUndo`
- `canRedo`

## 渲染层：`packages/art`

渲染器改进：

- active root 支持
- `Renderer.fitToContent(rootId?, padding?)`
- 基于图数据的只读渲染投影
- 树遍历循环保护
- 通过 `dispose` 做 rAF 生命周期清理

评审点：

- `packages/art/src/core/render.ts`
- `packages/art/src/render/canvas/canvas2DBackend.ts`

## Worker Pipeline

worker 在服务调用后计算 dirty 派生状态：

```txt
RPC 调用 / 通知
  -> ChannelServer.onMessage
  -> BaristaEngine.scheduleTick
  -> MatrixSystem
  -> AABBSystem
  -> scene.onDirty
```

评审点：

- `packages/barista/src/worker/baristaEngine.ts`
- `packages/barista/src/systems/matrix.ts`
- `packages/barista/src/systems/aabb.ts`

已新增循环保护，避免无界遍历。

## 应用集成：`apps/cafe`

`apps/cafe` 现在使用 `EditorRuntime`，
而不是手工串联 editor、bridge 与 document load。

评审点：

- `apps/cafe/src/app.tsx`
- `apps/cafe/package.json`
- `apps/cafe/vite.config.js`

Vite 开发与预览都包含 COOP/COEP 响应头，
以确保 SharedArrayBuffer 可用。

## 测试与工具链

新增或相关覆盖：

- SAB 空外部 buffer 初始化
- loader root 拓扑
- matrix/AABB 遍历循环保护
- render `fitToContent`
- worker 加载与只读投影 smoke
- transform 事务 abort/commit
- dispatcher 拥有的 transform 自动事务行为
- service/system 注册期 mutation policy 解析
- channel 顺序调度以避免冲突
- transaction mutation recording
- history undo/redo
- runtime interaction 合并（coalescing）与类型化服务委托

关键文件：

- `e2e/cafe-smoke.spec.ts`
- `playwright.config.ts`
- `turbo.json`
- 根目录 `package.json`

## 验证命令

2026-06-04 当前状态已通过以下命令验证：

```sh
pnpm type-check
pnpm test
pnpm --filter @latte-js/cafe build
pnpm --filter @latte-js/espresso build
pnpm --filter @latte-js/barista build
pnpm --filter @latte-js/espresso test
pnpm --filter @latte-js/barista test
pnpm licenses:check
git diff --check
```

`pnpm e2e` 已尝试运行，但当前本机缺少 Playwright Chromium 可执行文件：
`/Users/wt/Library/Caches/ms-playwright/chromium_headless_shell-1200/.../chrome-headless-shell`。
需要先执行 `pnpm exec playwright install chromium`，或在 CI 中执行
`pnpm exec playwright install --with-deps chromium` 后再作为发布门禁。

说明：2026-06-04 已针对 `@latte-js/espresso` 超时风险做收敛：
测试环境默认容量降为 20k 节点，生产默认仍为 1M 节点；`SceneGraph`
构造阶段不再逐槽初始化全部矩阵，而是在根节点和新分配节点上初始化
identity matrix。最新 `pnpm --filter @latte-js/espresso test` 通过
14 个文件 / 141 个测试，serializer 与 nodeTypeConversion 不再触发
默认 5 秒单测超时。

## 已知后续事项

1. 将节点 create/delete/reparent 迁移到领域服务，并经由 `NodeCursor` 或等效结构写屏障写入。
2. 增加序列化节点快照，使 `removeSelf` 可安全 undo/redo。
3. 在父节点历史回放时保留同级顺序。
4. 接入 undo/redo 的命令与键绑定入口。
5. 增加一次实际 transform 后再 undo/redo 的 UI 层 smoke。
6. 审计直接 typed-array 写入，并将其归类为用户编辑写入或派生流水线写入。

## 评审清单

- 主线程不使用原始 mutation RPC。
- 主线程不使用通用 transaction RPC。
- 公开 API 保持类型化服务 API。
- mutation policy 在 service/system 注册时声明，并由 worker dispatcher 执行。
- worker RPC 顺序处理，避免 active session 交错。
- 代表用户编辑的 worker 写入流经 `NodeCursor`。
- 流水线写入不会污染历史。
- 事务提交仅在存在记录时创建 undo 条目。
- undo/redo 回放不创建新的历史条目。
- `TransformService` 在内部拥有 transform 交互 session 边界。
- transaction abort 使用记录的逆向 mutation + transform 快照进行即时回滚。
- 现有 cafe 样例在启用 SharedArrayBuffer 时仍可渲染。
