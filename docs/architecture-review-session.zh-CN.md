# Latte 架构评审完整会话文档

> 日期：2026-06-08
>
> 用途：把本轮长会话中的架构讨论、实现取舍、已落地代码、验证结果和后续风险整理成一份 review 对照文档。另一台电脑 review 时，建议先读本文，再对照 `docs/architecture-blueprint.zh-CN.md`、`docs/roadmap.zh-CN.md` 和最近两个 review snapshot commit。

## 0. Review 入口

当前 review snapshot 主要在以下提交中：

```text
c3e7f1a chore: prepare architecture review snapshot
c28d14a chore: stage transfer review snapshot
```

建议 review 顺序：

```sh
git fetch
git checkout codex/temp-transfer-review-20260606
git log --oneline -5
git show --stat c28d14a
git show --stat c3e7f1a
```

建议先看文档，再看代码：

1. `docs/architecture-blueprint.zh-CN.md`
2. `docs/roadmap.zh-CN.md`
3. `docs/governance-and-licensing.zh-CN.md`
4. `docs/figma-layout-resize-plan.zh-CN.md`
5. 本文档
6. `packages/espresso`
7. `packages/barista`
8. `packages/crema`
9. `packages/syrup` / `packages/counter` / `packages/art`
10. `apps/cafe`

## 1. 本轮总目标

Latte 的长期目标被重新明确为：

```text
Figma 级画布编辑能力
+ VSCode 级 service / command / contribution / extension 架构
+ 可商业化开源治理
+ Worker 权威写入
+ SharedArrayBuffer / SoA 只读投影
+ 未来可选 Rust/WASM native engine
```

本轮所有讨论基本围绕一个主线展开：

```text
UI / Input / Keybinding / Plugin
  -> Command as user-intent entry
  -> Workbench contribution
  -> Service as domain capability
  -> RPC or local implementation
  -> Worker mutation authority
  -> NodeCursor / SceneGraph / SoA / SAB
  -> Worker pipeline recompute
  -> Projection dirty notification
  -> Main-thread readonly render/UI readback
```

核心原则：

- 主线程不直接写 document model。
- worker 是文档写入权威。
- 主线程可以读共享投影，但读的是 projection，不是权威写入口。
- 高频交互不需要每一帧走 command。
- command 是用户意图入口，service 是领域能力边界。
- 事务由 worker 自动管理，主线程和插件不直接调用通用 transaction API。
- undo/redo 是独立服务，不属于 TransformSystem。
- history 和 transaction 是两件事。
- dirty flags 描述下游 pipeline invalidation target，不描述 mutation 类型。

## 2. SharedArrayBuffer + SoA + Worker 路线

本轮一开始重新评估了：

```text
SharedArrayBuffer + SoA 内存布局 + Worker 计算 + 渲染层只读投影
```

相对于主线程直接做所有事，它的优点：

- 主线程更专注输入、UI 和 render scheduling。
- worker 可以集中处理文档写入、事务、history、派生重算。
- SoA 对大量节点的矩阵、bounds、style pointer 等热数据更友好。
- SharedArrayBuffer 避免大量结构化拷贝。
- 便于未来接入协同、extension host、Rust/WASM native engine。

劣势：

- 架构复杂度明显更高。
- 需要 COOP/COEP 才能稳定使用 SharedArrayBuffer。
- 需要处理 projection sync、version、dirty notification。
- 主线程不能随意写，开发纪律更强。
- 对调试和测试要求更高。

综合判断：

当前项目目标不是普通 canvas demo，而是长期平台型编辑器。因此继续走
`SAB + SoA + worker authority + readonly projection` 是更优路线。

## 3. Coffee Stack 包职责

最终包职责建议如下。

| 包 | 定位 | 应该包含 | 不应该包含 |
| --- | --- | --- | --- |
| `bean` | 协议与类型契约 | schema、RPC contract、ID type、公共协议 | 运行时逻辑、UI、worker 实现 |
| `espresso` | 数据内核 | SceneGraph、NodeCursor、SoA、SAB、heap/blob、loader/serializer | 业务 service、React、插件 API |
| `barista` | worker 权威执行层 | RPC services、systems、MutationGate、HistoryManager、pipeline | DOM、React、主线程工具状态 |
| `syrup` | 主线程平台层 | EditorHost、DI、Command、Menu、Keybinding、Input、本地/RPC service 注册能力 | 产品工具业务、worker 写入实现、稳定插件 facade |
| `crema` | runtime assembly | 启动 worker、创建 editor/runtime、注册 services、projection sync、interaction controller | 具体工具业务、SoA 细节 |
| `counter` | workbench/contrib | SelectionService、ToolService、内置工具、内置 command handlers | 平台 DI 内核、worker mutation 实现 |
| `art` | 渲染与命中 | Renderer、Camera、HitTest、readonly projection 绘制 | document 写入、事务、history |
| `milk` | UI 组件 | React 控件、面板、输入框、hooks | document 权威写入 |
| `api` | 未来插件 facade | `ctx.nodes`、`ctx.commands`、`ctx.selection`、`ctx.workspace` | 内部 service 实例直接泄漏 |

`counter` 当前更像 VSCode 的 workbench/contrib。短期可保留名称，文档中明确它就是内置产品贡献包；未来如果追求语义清晰，可改名为 `@latte-js/workbench`。

## 4. Command、Service、Controller 的边界

最终规则：

```text
Command = 用户意图入口
Service = 领域能力边界
Controller = 高频交互编排
System = worker 内部领域计算模块
Manager = worker/runtime 内部状态管理基础设施
```

### 4.1 是否所有操作都走 command

不应该。

VSCode 内部也不是所有高频编辑器交互都走 `executeCommand`。快捷键、菜单、命令面板、插件显式命令通常走 command；内部 controller/editor 代码大量通过 DI 获取 service。

Latte 推荐：

| 场景 | 推荐入口 |
| --- | --- |
| 命令面板执行对齐 | Command |
| 快捷键删除节点 | Command -> NodeService |
| 属性面板手动输入 x/y/w/h 后 Enter/blur | Command 或直接 service |
| 属性面板拖拽 scrub 数值 | begin edit -> service notification -> commit |
| 画布拖拽移动 | Tool/InteractionController -> TransformService |
| 插件移动节点 | Public API facade |
| undo/redo | UndoRedoService |

### 4.2 面板输入框与拖拽 scrub

Figma 的宽高位置输入框既能输入，也能拖拽 scrub。Latte 应按两种语义处理：

```text
手动输入后 Enter / blur
  -> command 或 service
  -> worker atomic transaction
  -> 生成一次 history

拖拽 scrub 数值
  -> pointerdown: beginTransform / beginPropertyEdit
  -> pointermove: service notification，按 rAF 合并
  -> pointerup: commit
  -> 生成一次 history
```

拖拽不会绕过事务。它绕过的是每帧 command，不是绕过 worker transaction。

## 5. EditorHost、Syrup、DI 与插件 API

### 5.1 EditorHost 的职责

`EditorHost` 不应成为“所有能力集合”。更合理的职责：

- 作为 main-thread editor host。
- 持有当前 graph projection、active document/session 的轻量主线程状态。
- 承载 renderer attachment，但不负责创建 renderer。
- 提供 per-editor service scope / disposable root。
- 承接 service collection / instantiation infrastructure。
- 不长期承担 document 权威写入。
- 不负责创建 Worker、BaristaClient、Renderer 或 worker RPC proxy。
- 不直接成为公开插件 API facade。

### 5.2 为什么保留 main-thread service 概念

参考 VSCode，调用方不应关心 service 真实执行地点：

```text
ISelectionService 可能是主线程本地
INodeService 可能是 worker RPC
ITransformService 可能是 worker RPC
IToolService 可能是 workbench 本地
```

因此 service 可以注册到主线程 DI，但这不等于插件作者可以直接拿内部 service。

长期插件 API 应是稳定 facade：

```ts
ctx.commands.execute(...)
ctx.nodes.moveBy(...)
ctx.selection.get()
ctx.workspace.activeDocument
```

Facade 内部可以调用 command，也可以调用 service。插件作者不应依赖内部 `editor.getService(...)`。

### 5.3 `syrup/services/proxies` 已移除

全局 proxy 设计长期不合适，因此已经移除：

- 依赖全局 editor。
- 不支持多 editor/multi document。
- 绕过 ServiceCollection。
- 把 worker channel 与主线程 service 隐式混在一起。

当前目标已经切到由 `crema` 在 runtime startup 时注册 local services 与 worker RPC services。

## 6. 事务、历史与 Undo/Redo

本轮重点澄清：

```text
TransactionManager != HistoryManager
```

### 6.1 TransactionManager

只负责当前事务生命周期：

- `begin`
- capture snapshot
- record mutation
- `commit` 产出 committed transaction
- `abort` 使用 inverse records 回滚当前事务

它不应该保存 undo/redo 栈。

### 6.2 HistoryManager

负责 history 状态：

- undo stack
- redo stack
- push committed transaction
- undo replay inverse records
- redo replay forward records

命名上最终选择 `HistoryManager`，因为它管理 history stack，是 worker 内部基础设施；`UndoRedoService` 才是外部语义 service。

### 6.3 UndoRedoService

主线程和插件未来只应看到：

- `undo`
- `redo`
- `canUndo`
- `canRedo`

不应暴露通用 transaction API。

### 6.4 为什么主线程不管理事务

主线程直接管理事务会带来危险：

- 插件可能忘记 commit/abort。
- 高频交互和 atomic operation 语义混在一起。
- 多文档、多协作者、worker session 切换更容易出错。
- undo/redo 难以统一。

最终选择：

```text
主线程只发语义 RPC
worker MutationGate 自动处理事务
service/system 注册时声明 mutation policy
```

### 6.5 MutationGate 与 mutation policy

Service/System 通过注册声明：

- `readonly`
- `writeNoHistory`
- `atomic`
- `manual`
- `sessionBegin`
- `sessionMutation`
- `sessionCommit`
- `sessionCancel`
- `history`

dispatcher 通过 `MutationGate` 统一包裹。

### 6.6 TransformSystem 不再拥有 undo/redo

TransformSystem 只做 transform 领域计算。

不应该：

- 在 TransformSystem 中调用 undo/redo。
- 在 TransformSystem 中长期拥有通用 transaction 生命周期。

添加、删除、重命名、样式修改都应通过自己的 service/system 进入同一个 MutationGate 和 NodeCursor 写入口。

## 7. Mutation RPC 与语义化 Service

旧思路里有 `MutationService` / raw mutation RPC。本轮决定移除公开 mutation RPC。

原因：

- 主线程应该保持 VSCode 风格的语义服务。
- mutation record 是内部日志/历史关注点，不是主线程编程模型。
- `NodeService.move()`、`TransformService.resizeTo()`、`StyleService.setFill()` 这样的能力更清晰。
- 插件 API 也不应该暴露 raw mutation bus。

最终方向：

```text
UI / Command / Plugin
  -> Semantic Service
  -> RPC
  -> Worker Service
  -> MutationGate
  -> System / NodeCursor
  -> Mutation records / dirty pipeline
```

## 8. NodeCursor 作为写入口

本轮多次讨论后确认：

- 用户编辑类写入应尽量通过 `NodeCursor` 或等效写屏障。
- `MutationRecordApplier` 回放 undo/redo 也应走同一种数据结构。
- 不应让主线程写、redo/undo 写、worker service 写各有一套不同路径。

这样更容易维护：

- dirty 标记统一。
- mutation record 统一。
- undo/redo replay 统一。
- 协同和审计未来可以复用。

派生写入例外：

- `worldMatrix`
- `aabb`
- pipeline projection

这些是 worker pipeline 的派生数据，不应进入历史。

## 9. Selection 设计

当前结论：

- `SelectionService` 作为主线程 service 名称是合理的。
- 这符合 VSCode 风格：调用方不关心能力来源是本地、远程还是 RPC。
- selection 当前是 UI/session state，不是 document model。
- 主线程需要快速响应 hover、selection outline、property panel。

因此当前保留主线程 SelectionService 更合适。

### 9.1 是否需要 worker-side SelectionContext

短期不需要强行加。

性价比：

- 当 selection 只负责选中 ids、overlay、属性面板时，主线程足够。
- 当需要 OBB、复杂 bounds、snap guides、resize handles、多人协同时，再加入 worker-side SelectionContext。

未来增强：

```text
Main SelectionService
  -> sync selected ids to worker
  -> worker computes OBB / handles / snap guides
  -> writes projection
  -> main reads projection
```

## 10. 主线程读取与 SAB projection 同步

曾经出现的问题：

```text
worker 有数据，主线程读不到
```

根因主要是：

- 主线程 graph 和 worker graph 不是同一套写入来源。
- loader 曾经可能在主线程二次写 graph。
- idMap / heap metadata / projection sync 没同步完整。

当前方向：

- worker load document。
- worker 写 SAB 和 heap/blob metadata。
- main 只同步 idMap、active root、projection dirty/version。
- renderer/art 从 SAB 只读 projection。

字符串、JSON-like metadata 的路径：

```text
name / fills / strokes / text / geometry
  -> shared heap / blob
  -> SoA pointer columns
  -> main thread 通过 pointer 读
```

因此 name 本质不是直接存在 TypedArray 数值列里，而是通过 pointer column 指向 heap/blob 中的字符串/JSON-like blob。

## 11. 渲染与 Projection

渲染层原则：

- `art` 只读。
- 不做 document 权威写入。
- 读取 SAB projection。
- 根据 dirty notification 调度 render。

本轮落地：

- `Renderer.fitToContent(rootId?, padding?)`
- active root 支持
- 负坐标样例可以首屏可见
- traversal cycle guard
- renderer dispose 清理 rAF

当前渲染流程：

```text
worker mutation
  -> dirty tracker
  -> pipeline recompute
  -> scene.onDirty payload
  -> ProjectionSyncController.markDirty
  -> renderer.requestRender
  -> renderer read SAB projection
```

## 12. Dirty Flags 重构

本轮将 dirty flag 从“mutation category”改成“pipeline invalidation target”。

当前 dirty flags：

- `DIRTY_LOCAL_MATRIX`：local matrix 失效
- `DIRTY_PAINT`：paint/compositing 失效
- `DIRTY_TREE`：树拓扑输入变化
- `DIRTY_WORLD_BOUNDS`：world bounds 派生失效
- `DIRTY_TEXT`：文本内容/样式/layout 输入失效
- `DIRTY_METADATA`：name、lock、plugin metadata
- `DIRTY_SUBTREE_MATRIX`：子树中存在 matrix-affecting change 的派生遍历标记
- `DIRTY_GEOMETRY`：本地 shape/size/path 变化
- `DIRTY_LAYOUT`：layout constraints/autolayout 输入失效
- `DIRTY_EFFECT`：blur/shadow/filter 可能影响 visual bounds

已全量移除旧名：

- `DIRTY_TRANSFORM`
- `DIRTY_STYLE`
- `DIRTY_STRUCTURE`
- `DIRTY_AABB`
- `DIRTY_NOT_EFFECT`

### 12.1 三个容易混淆的 flag

`DIRTY_TREE`

- 表示 document topology input 变化。
- parent/child/order 变化。
- 会影响 matrix、bounds、layout。

`DIRTY_SUBTREE_MATRIX`

- 派生遍历剪枝标记。
- 表示某个祖先的子树里有 matrix-affecting dirty。
- 不是用户 mutation 分类。

`DIRTY_LAYOUT`

- 表示 layout rule/input invalidated。
- 未来由 LayoutSystem 消费。
- 不等于 tree，也不等于 subtree matrix。

## 13. MutationTracker

`MutationTracker` 的根本目的：

```text
收集哪些 node 的哪些 pipeline target 失效
  -> 合并同一 tick 内多次变化
  -> 做极少量便宜派生传播
  -> 交给 worker pipeline 重算
```

它不负责：

- 执行 pipeline。
- 通知主线程。
- 管理 render。
- 管理事务或 history。

当前保留的派生传播：

- 如果 dirty 命中 `MATRIX_AFFECTING_FLAGS`，向父链冒泡 `DIRTY_SUBTREE_MATRIX`。

已收紧：

- `getSnapshot()` 返回 defensive copy。
- 移除未使用 flushing 开关。
- 父链冒泡加入 cycle/depth guard。

## 14. Worker Pipeline

本轮将 pipeline 从 `BaristaEngine.tick()` 中抽出一层。

当前流程：

```text
BaristaEngine.tick
  -> tracker.flush()
  -> DirtyBatch.from(...)
  -> PipelineRunner.process(batch)
  -> NotificationPlanner.createDirtyPayload(batch, version)
  -> scene.onDirty(payload)
```

新增：

- `packages/barista/src/pipeline/dirtyBatch.ts`
- `packages/barista/src/pipeline/pipelineRunner.ts`
- `packages/barista/src/pipeline/notificationPlanner.ts`
- `packages/barista/src/pipeline/__test__/pipelineRunner.test.ts`
- `packages/barista/src/pipeline/__test__/notificationPlanner.test.ts`

### 14.1 DirtyBatch

封装 dirty map：

- `mark`
- `markDerived`
- `hasAny`
- `entriesByMask`
- `keysByMask`
- `idsByMask`

它是 pipeline batch 容器，不属于 `espresso`。

### 14.2 System schedule

本轮把 `@system({ pipeline: ... })` 改成了更中性的：

```ts
@system({
  schedule: {
    stage: ScheduleStage.Matrix,
    reads: DIRTY_LOCAL_MATRIX | DIRTY_TREE | DIRTY_SUBTREE_MATRIX,
    writes: DIRTY_WORLD_BOUNDS,
  },
})
```

原因：

- MatrixSystem 不应被设计成只能给 pipeline 使用。
- `schedule` 表达“这个 system 在 dirty 调度中如何被触发”。
- system 仍可被测试或 worker 内部直接调用。

### 14.3 PipelineRunner

当前 runner：

- 按 `ScheduleStage` 排序。
- 读取 system 的 `schedule.reads`。
- 只有 batch 中存在命中的 dirty 时才触发 system。
- 把完整 `DirtyBatch` 传给 system。

这样比所有 system 扫所有 dirty ids 更合理。

### 14.4 NotificationPlanner

`scene.onDirty` payload 从纯 ids 升级为：

```ts
{
  version,
  ids,
  renderIds,
  allIds,
  nodes: [{ id, flags }]
}
```

当前约定：

- `ids` 保留为 render ids 的兼容字段。
- `renderIds` 表示需要画布重绘。
- `allIds` 表示所有 dirty ids。
- `nodes` 保留 flags，未来 UI/插件/outline 可按需消费。

`ProjectionSyncController` 兼容旧数组 payload，也支持新 payload。

metadata-only dirty：

- 推进 projection version。
- 不触发 renderer.requestRender。

### 14.5 system 消费中产生新 dirty

当前已支持前向链路：

```text
MatrixSystem reads LOCAL_MATRIX/TREE/SUBTREE_MATRIX
  -> writes WORLD_BOUNDS
  -> AABBSystem reads WORLD_BOUNDS
```

因为 runner 传的是同一个 mutable DirtyBatch。

尚未完整支持反向依赖：

```text
后置 system 产生前置 system 需要消费的 dirty
```

推荐长期升级：

- pipeline 尽量保持单向 DAG。
- Layout/Text 等系统放在 Matrix 前。
- runner 引入 worklist/fixpoint。
- 根据 reads/writes 构建依赖图。
- back edge 默认报错，或显式 `allowBackEdge`。
- 加 max iteration 防循环。

## 15. Tree Traversal 与 SceneGraph API

本轮整理了 tree traversal：

- 将重复遍历逻辑收敛到共享 traversal helper。
- `SceneGraph` 内部仍保留核心树操作。
- query 和 SceneGraph 不应各自维护一套语义相近但 guard 不一致的遍历。

关注文件：

- `packages/espresso/src/data/treeTraversal.ts`
- `packages/espresso/src/query/treeWalker.ts`
- `packages/espresso/src/query/traversalGuards.ts`
- `packages/espresso/src/data/sceneGraph.ts`

API 原则：

- `espresso` 是数据内核。
- 不引入 `kit` 或平台层依赖。
- tree traversal guard 应尽量函数式、可复用。
- observer disposable、heap/blob lifecycle 属于下一阶段生命周期/API 清理。

## 16. Heap / Blob / Allocator

讨论过 `_readBlockSize` 与 `_allocSizes` 的唯一真值问题。

最终原则：

- 当前 heap/blob 是 JS 临时存储方案。
- 不要过早引入复杂 free-list。
- 如果后续 Rust/WASM native engine 接管存储与性能计算，heap/blob manager 可能被替换或下沉。
- 现阶段优先保持可理解、可测试、可迁移。

关于为什么既有 cache 又写 heap：

- cache 适合作为 JS 侧解码/对象缓存。
- heap/blob 是跨 worker/main 的共享投影来源。
- 如果只生成 id 而不写 heap，主线程无法仅通过 SAB/pointer 读取对应内容。
- 因此当前设计是 pointer column + shared blob + optional cache。

## 17. Rust/WASM 未来方向

Rust 是未来方向之一，但不是当前 P0 必须项。

适合 Rust/WASM 的场景：

- 大规模几何计算。
- Path boolean / flatten / stroke outline。
- AABB/OBB 批处理。
- 文档 snapshot/diff/replay。
- 压缩存储、二进制文件格式。
- 协同 CRDT/OT 核心。

边界：

- Rust/WASM 应挂在 worker service/system 后面。
- 不改变主线程 service/command/API facade。
- 不让 UI 直接依赖 native engine。
- 先用 JS 明确架构和测试，再用性能基线决定替换热点。

## 18. Figma Layout / Resize

本轮确认：

- 自由变换和 Frame/layout resize 是两条语义。
- Figma 的 `relativeTransform` 不长期承担 scaling 语义。
- resize 应走 width/height/layout constraints，而不是把所有缩放塞进 transform matrix。

后续方向见：

- `docs/figma-layout-resize-plan.zh-CN.md`

## 19. Governance、License 与商业化

本轮增加/调整了：

- issue templates
- PR template
- CODE_OF_CONDUCT
- SECURITY
- CONTRIBUTING
- README
- release gate script
- CI / e2e / license check 相关设置

商业化许可建议：

- 核心商业护城河包可使用 AGPL 或 GPL + 商业双授权。
- 协议、类型、SDK、插件 API 尽量使用更宽松协议，例如 MIT/Apache-2.0，以降低生态接入门槛。
- 不要让插件作者因为依赖 `bean` 或 public API 就被强制 GPL 污染。
- 如果未来做 cloud/collaboration/proprietary hosting，AGPL 比 GPL 更能覆盖网络服务场景。
- 最终要由法律专业人士确认，但工程划分应先支持“双授权核心 + 宽松生态边界”。

建议包许可分层：

| 包 | 建议 |
| --- | --- |
| `espresso` | AGPL/GPL + commercial dual license |
| `barista` | AGPL/GPL + commercial dual license |
| `crema` | 视商业策略，可 AGPL/GPL 或 proprietary-friendly dual |
| `art` | 可 AGPL/GPL 或 MPL/Apache，取决于是否作为核心护城河 |
| `bean` | MIT/Apache-2.0 更适合生态 |
| `syrup` | 可宽松或双授权，取决于是否作为平台内核商业资产 |
| `milk` | 通常可宽松，便于 UI 生态 |
| `api` | 推荐宽松 |

## 20. E2E、COOP/COEP 与测试治理

SharedArrayBuffer 需要 cross-origin isolation：

- COOP
- COEP

`apps/cafe` dev/preview/deploy 都需要保证 headers。

关于 e2e：

- 当前更推荐根目录统一 e2e。
- 不需要每个 package 都单独 `turbo run e2e`。
- package 单测/type-check/build 仍可按 package 运行。

release gate 应覆盖：

```sh
pnpm type-check
pnpm test
pnpm --filter @latte-js/cafe build
pnpm e2e
pnpm licenses:check
git diff --check
```

## 21. 当前已验证命令

本轮末尾已通过：

```sh
pnpm --filter @latte-js/espresso test
pnpm --filter @latte-js/barista test
pnpm --filter @latte-js/crema test
pnpm --filter @latte-js/bean type-check
pnpm --filter @latte-js/espresso type-check
pnpm --filter @latte-js/barista type-check
pnpm --filter @latte-js/crema type-check
pnpm --filter @latte-js/syrup type-check
pnpm --filter @latte-js/counter type-check
pnpm --filter @latte-js/art type-check
pnpm --filter @latte-js/cafe build
git diff --check
```

曾经的 review 阻断：

- `@latte-js/espresso` serializer / nodeTypeConversion 超时。

已处理方向：

- 测试环境节点容量降低。
- 初始化路径收敛。
- 最新 espresso test 已稳定通过。

仍需后续确认：

- release gate 全量 CI 状态。
- e2e 是否在安装 Playwright Chromium 后稳定。
- 删除历史回放的节点快照能力。

## 22. 当前仍需重点 review 的文件

### Espresso

- `packages/espresso/src/data/config.ts`
- `packages/espresso/src/data/sceneGraph.ts`
- `packages/espresso/src/data/nodeCursor.ts`
- `packages/espresso/src/data/mutationTracker.ts`
- `packages/espresso/src/data/treeTraversal.ts`
- `packages/espresso/src/query/treeWalker.ts`
- `packages/espresso/src/data/blobManager.ts`
- `packages/espresso/src/data/heapManager.ts`

Review 重点：

- dirty flags 是否仍有重叠或遗漏。
- SceneGraph API 是否过宽。
- NodeCursor 是否成为用户编辑写入口。
- 派生写入是否没有污染 history。
- traversal guard 是否一致。
- heap/blob lifecycle 是否足够安全。

### Barista

- `packages/barista/src/transactions/mutationPolicy.ts`
- `packages/barista/src/transactions/transactionManager.ts`
- `packages/barista/src/history/historyManager.ts`
- `packages/barista/src/history/mutationRecordApplier.ts`
- `packages/barista/src/systems/systems.ts`
- `packages/barista/src/pipeline/dirtyBatch.ts`
- `packages/barista/src/pipeline/pipelineRunner.ts`
- `packages/barista/src/pipeline/notificationPlanner.ts`
- `packages/barista/src/systems/matrix.ts`
- `packages/barista/src/systems/aabb.ts`
- `packages/barista/src/systems/transform.ts`
- `packages/barista/src/services/undoRedo.ts`

Review 重点：

- transaction/history 是否边界清晰。
- MutationGate 是否拥有所有写事务。
- schedule metadata 是否表达清楚，不把 system 绑定死为 pipeline-only。
- 当前 runner 是否足够处理 Matrix -> AABB。
- 后续 worklist/fixpoint 是否需要进入 P1。
- undo/redo replay 是否都走同一写入口。

### Crema

- `packages/crema/src/editorRuntime.ts`
- `packages/crema/src/interactions/transformInteractionController.ts`
- `packages/crema/src/projection/projectionSyncController.ts`

Review 重点：

- runtime 是否只负责 assembly。
- projection dirty payload 处理是否合理。
- 高频 transform coalescing 是否清楚。
- main thread 是否没有直接管理 transaction。

### Syrup / Counter

- `packages/syrup/src/core/editorHost.ts`
- `packages/syrup/src/services/command/commandService.ts`
- `packages/syrup/src/services/keybinding/keybindingService.ts`
- `packages/counter`

Review 重点：

- `syrup` 是否保持 platform 层。
- `counter` 是否承载 workbench/contrib。
- 内部 getService 与未来 public API facade 是否区分。
- 全局 proxy 是否仍有残留风险。

### Art / Cafe

- `packages/art/src/core/render.ts`
- `apps/cafe/src/app.tsx`
- `apps/cafe/src/main.tsx`
- `apps/cafe/vite.config.*`

Review 重点：

- renderer 是否只读 projection。
- fitToContent 是否可靠。
- canvas smoke 是否可见。
- COOP/COEP 是否生效。

## 23. Roadmap 摘要

### P0

- 收敛 worker authority + readonly projection。
- 移除主线程 loader 写 graph 长期路径。
- 淘汰全局 proxy。
- pipeline DirtyBatch/Schedule/NotificationPlanner 基础稳定。
- espresso dirty flags 和 traversal guard 稳定。
- cafe 可运行、可见、可构建。

### P1

- Workbench/counter 明确贡献机制。
- SelectionService / ToolService / commands 通过 DI 注册。
- StyleService 补齐，样式变更不绕过 mutation/history。
- Layout/Text/Effect system 进入 schedule。
- PipelineRunner 增加 worklist/fixpoint/back-edge 检测。
- worker-side SelectionContext 视性能需求加入。
- public API facade 草案。

### P2

- Extension host / sandbox。
- Manifest schema 和贡献点。
- 文件 schema migration。
- 协同、权限、command 权限。
- 性能基线和 Rust/WASM 热点替换。
- 完整 release gate。
- 决定 `counter` 是否重命名为 `workbench`。

## 24. Review 清单

架构边界：

- 主线程不直接写 document model。
- worker 是唯一权威写入端。
- renderer/art 只读 projection。
- `espresso` 不依赖平台层。
- `barista` 不依赖 DOM/React。
- `crema` 只做 runtime assembly。
- `syrup` 只做 main-thread platform。
- `counter` 只做 workbench/contrib。

调用链：

- command 是用户意图入口。
- 高频交互不每帧走 command。
- service 是领域能力边界。
- worker RPC 最终进入 MutationGate。
- NodeCursor 是用户编辑写屏障。

事务与历史：

- 主线程不暴露通用 transaction API。
- TransactionManager 不保存 undo/redo stack。
- HistoryManager 不管理 active transaction。
- UndoRedoService 是外部入口。
- undo/redo replay 不创建新的历史条目。
- 删除历史在节点快照前不应进入可回放 history。

Pipeline：

- dirty flag 表达 invalidation target。
- MutationTracker 只收集 dirty 和少量派生冒泡。
- PipelineRunner 通过 schedule 决定系统触发。
- Matrix -> AABB 前向派生链路可用。
- NotificationPlanner 在重算后通知主线程。
- scene.onDirty payload 区分 renderIds/allIds/nodes flags。

测试与治理：

- espresso/barista/crema 单测通过。
- type-check 通过。
- cafe build 通过。
- `git diff --check` 通过。
- COOP/COEP 配置可用。
- license 策略支持未来商业化。

## 25. 当前最重要的未完成问题

1. 删除节点的完整 history 快照和 replay。
2. reparent/sibling order 的完整可逆历史。
3. StyleService 和 LayoutService 的正式接入。
4. PipelineRunner 的 worklist/fixpoint/back-edge 检测。
5. SelectionContext 是否进入 worker 的触发标准。
6. Public extension API facade。
7. 多文档、多 editor、多窗口下 service/projection isolation。
8. Rust/WASM 是否进入性能热点路径，需要性能基线证明。
9. 全量 CI / e2e / release gate 稳定性。
10. `counter` 是否在语义上重命名为 `workbench`。

## 26. 一句话结论

本轮架构从“主线程能做很多事 + worker 是计算补充”的形态，进一步收敛为：

```text
主线程表达意图和读取投影；
worker 拥有写入、事务、历史和派生重算；
service 统一领域能力；
command 只承载用户意图入口；
pipeline 负责失效重算；
renderer 只读 SAB。
```

这是更接近“Figma 编辑能力 + VSCode 工程架构”的路线。
