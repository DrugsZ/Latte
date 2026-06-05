# Latte 架构演进 RoadMap

> 日期：2026-06-05
>
> 目标：将 Latte 演进为兼具 Figma 画布编辑能力与 VSCode 工程化/扩展架构的编辑器平台。

## 1. 总体判断

当前方向应继续沿着：

```text
SharedArrayBuffer + SoA 数据布局
+ Worker 权威计算/写入
+ 主线程只读投影与交互编排
+ VSCode 风格 Service/RPC 边界
```

这条路线推进。

主线程不应直接写 document model。主线程可以：

- 做 hit test、selection、hover、keyboard/mouse、overlay 等交互状态。
- 读取 worker 写入后的共享投影。
- 通过语义化 Service/RPC 发起编辑命令。
- 做轻量 optimistic preview 或 overlay，但不作为权威 document 写入源。

worker 应作为 document model 的唯一权威写入者：

- 通过 `NodeCursor`/MutationGate 统一修改 SoA。
- 负责 transform、matrix、AABB、history replay、future snap/layout 等计算。
- 写入 SharedArrayBuffer projection。
- 发 dirty/version 通知给主线程。

## 2. 架构原则

### 2.1 主线程 API 是语义边界

主线程应使用 `NodeService`、`TransformService`、`StyleService`、`SelectionService`、`UndoRedoService` 等 VSCode 风格服务。

调用方不需要知道能力来自本地、worker、RPC 或未来 extension host。Service 名称表达的是调用语义，不表达部署位置。

### 2.2 Worker 是权威写入边界

所有 document model 写入最终都应收口到 worker 内部：

```text
Main Service Call
  -> RPC
  -> Worker Service
  -> System/Manager
  -> NodeCursor
  -> SoA/SAB
  -> Dirty Pipeline
  -> Main Projection Read
```

无论是普通操作、undo、redo、插件命令，最终都应复用同一套 mutation record 与 NodeCursor 写入路径。

### 2.3 Transaction 与 History 分离

Transaction 负责一次编辑操作的记录生命周期：

- begin
- record mutations
- commit
- abort

History 负责用户可见的 undo/redo 栈：

- undo stack
- redo stack
- inverse records
- replay

`TransactionManager` 不应保存长期历史栈，也不应直接承担 undo/redo 语义。`HistoryManager` 更适合管理 history journal。

### 2.4 Selection 是 UI/Session 状态

当前主线程 `SelectionService` 持有 selected ids、active id、anchor id 是合理的。

Selection 不应混入 document graph。后续可以增加 worker-side `SelectionContext`，但它应是同步过来的 session projection，用于 worker 计算 bounds、OBB、snap、resize handles，而不是替代主线程 SelectionService。

### 2.5 只在边界做运行时校验

TypeScript 类型继续作为内部开发契约。

Zod 或类似运行时 schema 校验只应放在边界层：

- 文件导入。
- plugin manifest。
- external command/RPC payload。
- workspace/config。
- schema migration。

不应放在 NodeCursor、SoA hot path、Matrix/AABB pipeline、renderer inner loop。

## 3. 当前基线

当前已经落地的关键基础：

- `packages/espresso`：SAB + SoA SceneGraph、NodeCursor、loader/serializer、shared heap/blob pointer columns。
- `packages/barista`：worker engine、ChannelServer/Client、MutationGate、TransactionManager、HistoryManager、UndoRedoService、Systems。
- `packages/syrup`：main-thread Editor、Document、Input、Renderer 接入。
- `packages/crema`：EditorRuntime、RuntimeInteractionController、ProjectionSyncController。
- `packages/counter`：SelectionService、SelectionTool、Workbench。
- `packages/art`：Renderer、HitTester、fitToContent、RTree。
- `apps/cafe`：集成样例与 smoke/e2e 基础。
- 工程治理：type-check、test、e2e smoke、license check、COOP/COEP 配置。

当前需要重点 review 的结构：

```text
Main Thread
  syrup Editor
  crema EditorRuntime
  counter SelectionService
  art Renderer/HitTester

Worker
  barista Services
  barista Systems
  MutationGate
  TransactionManager
  HistoryManager

Shared Data
  espresso SceneGraph
  SoA columns
  HeapManager / BlobManager
```

## 4. P0：收敛当前改动到可合并状态

### 目标

让当前架构推进成果具备可 review、可合并、可回归验证的基本质量。

### 工作项

1. 拆分 review 单元
   - 架构运行时与 SAB projection。
   - transaction/history/undo-redo。
   - selection/projection sync。
   - e2e/CI/license 治理。
   - 文档。

2. 修正 license 发布前细节
   - MIT 包内 `LICENSE` 不应保留 `[year] [fullname]` 占位。
   - 明确各包 license 策略是否符合商业化诉求。
   - 保留 `scripts/check-licenses.mjs` 作为 CI gate。

3. 保持基础验证通过
   - `pnpm type-check`
   - `pnpm --filter @latte-js/espresso test`
   - `pnpm --filter @latte-js/crema test`
   - `pnpm --filter @latte-js/cafe build`
   - `pnpm e2e`
   - `pnpm licenses:check`
   - `git diff --check`

4. Review 风险清单
   - 是否有主线程直接写 document model。
   - 是否有 history replay 绕过 NodeCursor。
   - 是否有 legacy local Map 继续作为 metadata 权威来源。
   - 是否有 RPC notification error 被吞。
   - 是否有 delete/reparent 被错误纳入 history。
   - 是否有 heap resize 导致 worker/main buffer 分裂。

### 验收标准

- Cafe 首屏可见，无 pageerror。
- `crossOriginIsolated === true`。
- SAB 可用。
- Espresso 全量测试稳定通过。
- 全量 type-check 通过。
- 当前 staged diff 能被拆分 review，不依赖隐藏本地状态。

## 5. P1：主线程投影一致性

### 目标

主线程读到的是 worker 写入后的可信投影，并且读时序、ID map、dirty 通知、heap/cache 规则有清晰收口。

### 工作项

1. 强化 `ProjectionSyncController`
   - 统一管理 id map reset/register/unregister。
   - 统一管理 dirty ids。
   - 增加 scene projection version。
   - 对 document switch/load/close 做 reset。
   - 对 deleted selected ids 做清理通知。

2. 明确读时序
   - RPC mutation 返回不等于 projection fully rendered。
   - 读 AABB/RTree/selection bounds 前需要等待 dirty/version 或下一帧。
   - Renderer rebuild RTree 的时机要有可测试约定。

3. 处理 shared heap 风险
   - shared session 初始化后禁止主线程触发 heap resize。
   - worker wrapper 使用 non-resizable heap。
   - 如果未来需要 grow，设计 heap replacement protocol 或固定大 heap/reserved heap。

4. Metadata 统一 shared pointer
   - name：`namePtr -> shared heap raw string`。
   - fills/strokes：`fillPtr/strokePtr -> shared heap JSON object/array`。
   - geometry：`geometryPtr -> shared heap JSON object`。
   - 禁止再引入 wrapper-private metadata Map 作为权威来源。

### 验收标准

- worker load 后主线程 `getIndex(id)`、`getUUID(index)` 可用。
- worker create/delete 后主线程 ID map 同步。
- 主线程 HitTester 不依赖 private Map。
- Renderer/Selection/Query 只读 projection。
- 添加测试覆盖：load、create、delete、dirty、graph switch。

## 6. P2：语义化 Services 完整化

### 目标

形成 VSCode 风格主线程 API 与 worker System/Manager 的稳定分层。

### 工作项

1. 补齐主线程服务
   - `NodeService`
   - `TransformService`
   - `StyleService`
   - `SelectionService`
   - `UndoRedoService`
   - `CommandService`
   - `EditorService`

2. 统一 mutation policy
   - readonly
   - writeNoHistory
   - atomic
   - sessionBegin
   - sessionMutation
   - sessionCommit
   - sessionCancel
   - manual

3. StyleService 设计
   - fill/stroke/name/visibility/opacity/lock/cornerRadius 等样式修改走 worker。
   - 修改最终落到 NodeCursor。
   - history record 与 dirty flag 完整。

4. NodeService 设计
   - create/delete/reparent/insert/reorder。
   - delete history 在支持完整 serialized node snapshot 前保持 no-history 或显式禁止。
   - reparent history 需要记录 parent/order inverse。

### 验收标准

- 主线程业务代码不直接 new worker system。
- 所有 service methods 都有 mutation policy 覆盖。
- mutation policy test 能发现新增方法未声明策略。
- undo/redo、普通 mutation、notification mutation 共用同一写入收口。

## 7. P3：Selection 与几何能力

### 当前决策

保留主线程 `SelectionService` 作为 selection 状态拥有者。

当前不实现完整 worker-side `SelectionContext`。

### 何时增加 worker-side SelectionContext

满足以下任一条件时再添加：

- 多选上百/上千节点时拖拽、旋转明显卡顿。
- 需要 worker 计算 selection bounds、OBB、resize handles。
- 需要吸附、智能参考线、约束解算。
- 插件需要 worker 侧读取当前 selection。
- 主线程 overlay 依赖 worker 派生结果，而不是轻量读 projection。

### 未来设计

```text
SelectionService.onChange(ids, version)
  -> SelectionContextService.sync(ids, version)
  -> Worker resolves ids to indices
  -> Worker computes bounds / OBB / snap context
  -> Worker writes selection projection
  -> Main overlay reads projection
```

### OBB/AABB 策略

- 轻量 UI 可主线程读 projection 临时计算。
- 权威、批量、复杂几何计算交给 worker。
- AABB/worldMatrix 是 worker pipeline 的权威派生列。
- RTree 是 renderer-local acceleration structure，应由 projection dirty/version 驱动重建。

## 8. P4：文件、RPC、插件边界与 Zod

### 目标

在所有外部输入边界建立 runtime validation，避免坏 JSON、坏插件 manifest、坏 RPC payload 进入核心数据层。

### 是否引入 Zod

建议引入，但不在当前 P0/P1 立即铺开。

引入时机：P4。

推荐新包：

```text
@latte-js/schema
```

职责：

- 导出 Zod schemas。
- 导出 parse/safeParse helpers。
- 管理 schema version。
- 提供 migration 输入输出校验。

### 适合使用 Zod 的地方

- `DocumentService.load(data)` 前验证 `ILatteFile`。
- plugin manifest。
- external command payload。
- RPC message params。
- workspace/settings/config。
- schema migration。
- dev/test 下的 protocol assertion。

### 不适合使用 Zod 的地方

- NodeCursor getter/setter hot path。
- SoA typed array 读写。
- MatrixSystem/AABBSystem。
- renderer inner loop。
- transform 每帧 notification。
- shared heap blob 高频读。

### 验收标准

- 无效文件导入得到结构化错误。
- RPC 参数错误能返回 JSON-RPC error。
- plugin manifest 错误能定位字段。
- schema migration 可测试。
- 不影响 transform/render hot path 性能。

## 9. P5：性能、协同与扩展

### 性能基线

建立固定 benchmark：

- 加载节点数：1k / 10k / 50k。
- 首屏 render 时间。
- worker load 时间。
- matrix/aabb tick 时间。
- 多选拖拽耗时。
- undo/redo replay 耗时。
- shared heap blob read/write 耗时。

### 高频交互策略

继续使用：

```text
beginTransform
  -> RAF coalesced moveBy$/transformAround$
  -> dirty projection
  -> commitTransform request ack
  -> HistoryManager push
```

不要为性能让主线程直接写 document model。

如果 notification/RPC 成为瓶颈，再考虑：

- worker-side SelectionContext。
- shared command ring buffer。
- batched command payload。
- transform preview overlay。
- per-frame projection version barrier。

### 协同准备

协同前必须先有：

- command journal。
- scene version。
- mutation record 可序列化。
- deterministic replay。
- conflict policy。
- document snapshot/checkpoint。

协同不应直接基于“任意节点字段修改”，而应基于语义 command 或规范化 mutation record。

### 扩展架构

长期目标类似 VSCode：

```text
Extension Host
  -> Extension API
  -> Main Thread Services
  -> Worker RPC
  -> Document Model
```

插件不应获得 raw SAB 写权限。

插件能力通过 Service API 暴露：

- commands
- selection
- document query
- node/style/transform operations
- contribution points
- menus/keybindings/tools

## 10. 包职责演进

### `@latte-js/bean`

基础类型、RPC contract、公共 enum、轻量 schema 类型。

保持 MIT。

不引入重运行时依赖。

### `@latte-js/schema`

未来新增。

Zod runtime schemas、file validation、plugin manifest validation、migration validation。

建议 MIT。

### `@latte-js/espresso`

数据内核。

SAB、SoA、SceneGraph、NodeCursor、Loader/Serializer、shared heap。

不承担 UI/service/RPC 职责。

### `@latte-js/barista`

worker 计算与 mutation host。

Services、Systems、MutationGate、TransactionManager、HistoryManager、UndoRedoService、worker engine。

### `@latte-js/syrup`

主线程编辑器基础设施。

Editor、Document、Input、Command、Keybinding、Menu、Service registry、proxy service。

### `@latte-js/crema`

Editor runtime orchestration。

连接 syrup、barista、projection sync、runtime interaction。

### `@latte-js/counter`

内置工具与 workbench contributions。

SelectionTool、SelectionService、ToolService、PageService 等。

### `@latte-js/art`

渲染与交互检测。

Renderer、Camera、Backend、HitTester、RTree。

只读 projection。

### `apps/cafe`

集成样例和 smoke target。

不承载核心框架逻辑。

## 11. 暂缓项

以下事项暂不立即实现：

- 完整 worker-side SelectionContext。
- 主线程直接写 SoA。
- 协同编辑。
- 插件隔离运行时。
- Zod 全项目铺开。
- delete history serialized snapshot。
- shared heap grow protocol。
- 多后端渲染抽象大重构。

这些都不是方向错误，而是需要在前置边界稳定后再推进。

## 12. 下一步建议顺序

1. 完成当前 staged diff review。
2. 拆分 commit/PR，先合并 P0。
3. 修 MIT LICENSE 占位。
4. 补 projection version 与 graph switch 测试。
5. 设计 StyleService mutation policy。
6. 明确 delete/reparent history 策略。
7. 起草 `@latte-js/schema` RFC，但暂不实现。
8. 建立性能基线脚本。
9. 再评估 worker-side SelectionContext。

## 13. Review Checklist

- [ ] 主线程没有新增 document model 写入。
- [ ] mutation 都经过 worker Service/System/NodeCursor。
- [ ] undo/redo replay 没有绕过 NodeCursor。
- [ ] ID map 同步路径清楚。
- [ ] metadata 只通过 shared pointer columns 读取。
- [ ] dirty/version/render 时序可解释。
- [ ] selection 没有污染 document graph。
- [ ] e2e 验证 SAB 与 canvas 渲染。
- [ ] license check 与包 license 策略一致。
- [ ] 新增边界协议有测试覆盖。
