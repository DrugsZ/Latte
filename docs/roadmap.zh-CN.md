# Latte RoadMap

> 更新日期：2026-06-08
>
> 项目目标：把 Latte 演进为“Figma 级画布编辑能力 + VSCode 级工程化扩展平台”的可商业化开源编辑器内核。

本文档是 Latte 中长期路线图。它不是一次迭代的任务清单，而是后续架构设计、PR review、功能优先级和开源治理的共同依据。

## 1. 产品与架构目标

Latte 的长期形态不是一个普通 Canvas 组件，也不是一个只面向单一应用的设计工具。目标是提供一套可嵌入、可扩展、可商业化的图形编辑平台：

- 对用户：提供接近 Figma 的画布编辑、组件、变量、布局、协作、Dev Mode 与导出体验。
- 对开发者：提供接近 VSCode 的服务、命令、贡献点、上下文、配置、插件与扩展宿主模型。
- 对工程：以 `SharedArrayBuffer + SoA + Worker 权威写入 + 主线程只读投影` 作为性能与维护边界。
- 对性能：保留 Rust/WASM native engine 作为未来方向，用于被性能基线证明必要的几何、存储、snapshot/diff 和 replay 热路径。
- 对商业：核心能力可 AGPL 开源版 + 商业双授权，协议、SDK、插件基础设施尽量降低生态接入成本。

## 2. 设计原则

### 2.1 Worker 是文档写入权威

所有 document model 写入最终都应发生在 worker 内部：

```text
UI / Tool / Command / Plugin
  -> main-thread service facade
  -> RPC
  -> worker service
  -> MutationGate
  -> System / Manager
  -> NodeCursor
  -> SoA / SharedArrayBuffer
  -> Projection dirty/version
  -> Renderer/UI readonly readback
```

为什么：

- 避免主线程、插件、worker 多写导致读写冲突。
- 保证 undo/redo、协同、派生计算和审计都能复用同一 mutation 收口。
- 让高频计算离开主线程，主线程专注输入、UI、渲染调度和只读投影。

### 2.2 主线程 API 是语义边界

主线程应通过 `NodeService`、`TransformService`、`StyleService`、`SelectionService`、`UndoRedoService`、`CommandService` 等服务表达能力。

为什么：

- 调用方不需要知道能力来自本地、worker RPC、远程服务还是未来 extension host。
- 对齐 VSCode 的内部工程习惯：命令是用户意图入口，服务是领域能力边界。
- 高频交互不必把每一帧都包装成 command，但仍应通过 service/controller 进入 worker。

### 2.3 发送 target，不发送逐帧增量

移动、旋转、缩放、面板输入、插件 API 都应尽量发送明确目标值：

- `moveTo(worldPosition)` 或 session 内 `moveBy(totalWorldDelta)`。
- `rotateTo(angle)` 或基于 session snapshot 的目标矩阵。
- `resizeTo(size)` 或目标 selection box。
- 面板输入发送目标 `x/y/width/height/rotation`，由 worker 解析坐标语义。

为什么：

- 避免事件丢帧、RAF 合并、浮点误差带来的增量累计偏差。
- 多层嵌套、旋转父级、临时组选区下更容易保持视觉结果稳定。
- undo/redo 与协同 replay 更容易确定性复现。

### 2.4 Transform 与 Layout 分离

自由变换和 Figma Frame/layout resize 是两条不同语义：

- `TransformSystem`：move、rotate、free scale、临时组缩放、world step -> inverse parent local。
- `LayoutService` / `ConstraintsSystem` / `AutoLayoutSystem`：Frame resize、constraints、auto layout、group auto-bounds。

为什么：

- Figma 的 `relativeTransform` 不承担 scaling 语义，尺寸走 resize/width/height 体系。
- Frame resize 会触发 child constraints、auto layout、group 包裹和 ancestor bounds 派生，不能长期塞进 transform 分支。
- 分层后测试可以分别验证自由变换视觉角点和布局规则。

### 2.5 Transaction 与 History 分离

- `TransactionManager`：负责一次编辑操作的记录生命周期，包含 begin、record、commit、abort。
- `HistoryManager`：负责用户可见的 undo/redo 栈、inverse records 与 replay。
- `UndoRedoService`：对外提供 undo/redo 语义入口。

为什么：

- 事务是“正在发生的一次修改”，历史是“已经提交且可回放的用户行为”。
- 删除、reparent、style、transform、layout 的历史策略不同，不应把长期历史堆栈塞进事务管理器。
- replay 也应复用 NodeCursor/MutationGate 收口，避免绕过数据一致性机制。

### 2.6 Selection 是 UI/session 状态，不是 document graph

短期保留主线程 `SelectionService` 拥有 selected ids、active id、anchor id。

后续只有在需要 worker 批量计算 selection OBB、snap context、resize handles 或插件 worker-side selection query 时，再增加 worker-side `SelectionContext`。

为什么：

- Selection 高频但不一定是文档内容，不应污染文件 schema 和 document history。
- 当前主线程读 projection 计算轻量 selection overlay 性价比更高。
- worker-side SelectionContext 可以作为派生 session projection，而不是替代主线程 SelectionService。

### 2.7 Zod 只放在边界

建议未来引入 `@latte-js/schema`，但只用于：

- 文件导入和 schema migration。
- plugin manifest。
- external command/RPC payload。
- workspace/config。
- 测试和开发环境下的 protocol assertion。

不应放入：

- `NodeCursor` hot path。
- SoA typed array 读写。
- Matrix/AABB pipeline。
- renderer inner loop。
- 高频 transform notification。

为什么：

- 核心热路径需要靠 TypeScript + 单元测试 + 内部 invariant 保持性能。
- 外部输入边界需要运行时错误质量和安全性。

### 2.8 Rust/WASM 是可替换 native engine，不是当前默认实现

Rust/WASM 是 Latte 的长期性能和存储方向，但不应在 P0/P1 阶段提前把 JS 内核改成复杂的半成品 allocator。

推荐边界：

- 当前 JS `HeapManager`/`BlobManager` 保持临时 append-only blob store：写入追加，释放只做 tombstone。
- 真正的 free-list、compaction、snapshot-friendly allocator、二进制 blob store 可以由未来 Rust/WASM engine 承接。
- Matrix/AABB 批量计算、vector/boolean geometry、path flattening、snapshot/diff、history replay 可以成为 Rust/WASM 候选。
- Rust/WASM 必须挂在 worker/service/system 后面，不能让主线程、插件或 UI 获得 raw memory 写权限。
- 是否迁移必须由性能基线触发，而不是仅因“Rust 更快”而提前增加构建、调试和部署复杂度。

为什么：

- 当前核心风险仍是写入边界、history、projection、layout 语义，而不是 JS 单点性能。
- 过早引入 native allocator 会放大 SAB grow、调试、source map、CI、crossOriginIsolation 和 npm 发布复杂度。
- 保持 `SceneGraph`/`NodeCursor`/service contract 稳定，未来才能平滑替换内部实现。

## 3. 当前基线

### 3.1 已形成的基础

- `@latte-js/bean`：基础类型、节点枚举、文件/RPC 类型契约。
- `@latte-js/espresso`：SAB + SoA SceneGraph、NodeCursor、loader/serializer、临时 append-only shared heap/blob pointer columns。
- `@latte-js/barista`：worker engine、ChannelServer/Client、MutationGate、TransactionManager、HistoryManager、UndoRedoService、Transform/Matrix/AABB/Query systems。
- `@latte-js/crema`：EditorRuntime、ProjectionSyncController、RuntimeInteractionController。
- `@latte-js/syrup`：Editor、Document、Input、Command、Menu、Keybinding、DI/Instantiation。
- `@latte-js/counter`：内置 workbench/contrib、SelectionService、ToolService、SelectionTool。
- `@latte-js/art`：只读 Renderer、Camera、HitTester、RTree、fitToContent。
- `@latte-js/milk`：React UI 组件与面板承载层。
- `apps/cafe`：集成样例、SAB/COOP/COEP smoke target。

### 3.2 仍缺的关键能力

- 完整稳定的 release gate：type-check/test/build/e2e/license/diff-check 一键可信。
- Projection version、graph switch、ID map、metadata shared pointer 的一致性测试。
- delete/reparent 可逆历史。
- StyleService、LayoutService、Frame/constraints/auto layout。
- VSCode 风格 ContextKey、Configuration、Contribution Registry、Manifest/Activation。
- Figma 风格 Components/Instances/Variants、Variables、Libraries、Dev Mode、Export。
- 插件 public facade 与 extension host 隔离。
- 协同编辑、评论、版本历史、冲突策略。
- 性能基线与生产部署模板。
- Rust/WASM native engine 的基线评估、构建发布策略和替换边界。

## 4. P0：收敛当前架构到可发布内核

### 目标

把当前 worker 写入、只读 projection、事务/历史、transform 的基础做成可 review、可测试、可发布的内核基线。

### 要做什么

1. Release gate 固化
   - 固定入口：`pnpm release:check`。
   - 覆盖：license metadata、lint、type-check、unit tests、`apps/cafe` build、Playwright browser setup、smoke/e2e、`git diff --check`。
   - CI 使用同一个入口，避免本地 release gate 和 GitHub Actions 漂移。

2. Espresso 稳定性
   - serializer、nodeTypeConversion、SceneGraph、NodeCursor 测试稳定通过。
   - external blank SAB 初始化有防御逻辑。
   - tree traversal 有 cycle/depth guard。

3. Projection 一致性
   - worker load/create/delete 后主线程 ID map 可同步。
   - document switch/load/close 清理 projection state。
   - dirty ids、scene version、render request 时序有测试约定。

4. History 边界
   - `TransactionManager` 只做事务生命周期。
   - `HistoryManager` 管 undo/redo 栈和 inverse records。
   - undo/redo replay 不直接读写 SAB，统一走 mutation applier -> NodeCursor。
   - 在 delete/reparent 可逆快照完成前，禁止把不支持的结构变更放进 history。

5. Transform 基线
   - move/rotate/scale 使用 world target 与 snapshot 计算。
   - 多层嵌套、旋转父级、非等比缩放的渲染角点与预期一致。
   - 高频交互使用 target-from-snapshot，不叠加逐帧增量。

6. 文档与开源治理
   - 根 README、中文 README、包 README、apps README 与当前架构一致。
   - 贡献指南更新 worker 写入、mutation policy、测试要求。
   - 包级 license 和 README 许可证矩阵一致。

### 为什么

P0 是后续所有能力的地基。如果当前内核不能稳定加载、渲染、变换、撤销和回归测试，那么 layout、插件、协同都会把风险放大。

### 交付物

- 稳定通过的基础测试与 CI gate。
- 当前架构 README 和详细 RoadMap。
- worker-only write / readonly projection / history separation 的测试和文档。

### 验收标准

- Cafe 首屏可见，无 pageerror。
- `crossOriginIsolated === true`，`SharedArrayBuffer` 可用。
- Canvas 非空白。
- 全量 type-check、unit test、cafe build、license check 通过。
- 主线程没有新增 document model 写入路径。

## 5. P1：投影、样式与结构变更闭环

### 目标

让主线程读取 worker 写入后的可信投影，并补齐常见编辑操作的 service/API 边界。

### 要做什么

1. ProjectionSyncController 升级
   - scene projection version。
   - graph reset/register/unregister。
   - dirty ids 合并与下一帧可读约定。
   - 删除节点后 selection 清理。

2. Shared metadata 收口
   - `namePtr -> shared heap string`。
   - `fillPtr/strokePtr -> shared heap JSON`。
   - `geometryPtr -> shared heap JSON`。
   - 禁止 wrapper-private metadata Map 成为权威数据。
   - 当前 JS heap/blob 只做 append-only + tombstone release，不在 P1 里扩展成完整 allocator。

3. StyleService
   - fill/stroke/name/opacity/visibility/lock/cornerRadius 等修改走 worker。
   - NodeCursor 写入、dirty、history record 完整。
   - 高频样式 preview 与 commit 语义分开。

4. NodeService
   - create/delete/reparent/insert/reorder 的 RPC 与 mutation policy。
   - delete/reparent 增加 serialized node snapshot 与 sibling order inverse。
   - 不支持历史的结构操作必须显式 `writeNoHistory` 或拒绝。

5. QueryService
   - bounds、world matrix、children、ancestor、descendant query。
   - 只读 RPC 可以后续并发化。

### 为什么

Figma 类编辑器最容易坏在“主线程看见一套数据，worker 拥有另一套数据”。P1 要解决的就是数据可见性、ID 映射、metadata 和常规编辑 API 的一致性。

### 交付物

- Projection sync 测试矩阵。
- StyleService/NodeService/QueryService 文档和单测。
- delete/reparent history 设计和第一版实现。

### 验收标准

- worker load/create/delete 后主线程 query 与 renderer 都能读到一致结果。
- 普通 mutation、undo、redo、插件命令最终共用同一写入收口。
- 删除、reparent 不再出现 history 回放硬失败。

## 6. P2：Figma 对齐的几何与布局系统

### 目标

把自由变换、Frame resize、constraints、auto layout、group auto-bounds 分层实现，形成 Figma 风格几何语义。

### 要做什么

1. 坐标语义
   - 明确 local parent coordinate、containing parent coordinate、world/page coordinate。
   - 属性面板 X/Y/W/H/rotation 通过 service 进入 worker 解析。
   - Group/Boolean 的 containing parent 规则显式建模。

2. Constraints
   - `bean` 增加 constraints 类型。
   - `espresso` 增加 SoA enum columns。
   - `barista` 增加 ConstraintsSystem 和纯函数测试。
   - Frame resize 时按 left/right/center/stretch/scale 规则更新 children。

3. Auto layout
   - container properties：layout mode、padding、gap、alignment、hug/fill/fixed。
   - child properties：layout grow、align self、absolute positioning。
   - 先实现 horizontal/vertical 的可预测子集，再扩展复杂文本测量和 wrap。

4. Group auto-bounds
   - group/boolean bounds 由 children union 派生。
   - ancestor group 在 child 变化后自动更新。
   - 避免把 group 当普通 frame 直接 resize。

5. Free transform 保持独立
   - selection/temp group scale 使用 worldStep -> inverse parent local。
   - 测试以 rendered world corners 为准，而不是只看局部矩阵。

### 为什么

Figma 用户对 Frame、Group、Component、Auto Layout 的预期非常强。仅靠矩阵缩放无法覆盖面板 resize、约束响应、自动布局和 group 包裹，必须单独建立 layout 系统。

### 交付物

- `docs/figma-layout-resize-plan.zh-CN.md` 对应的实现任务拆分。
- LayoutService/ConstraintsSystem/AutoLayoutSystem/GroupBoundsSystem。
- 大量几何回归测试，覆盖旋转父级、多层嵌套、非等比缩放、constraints、auto layout。

### 验收标准

- Frame resize 的视觉结果与约束规则一致。
- Auto layout 基础场景可通过属性面板和工具触发。
- Group bounds 能随 children 自动派生。
- 自由变换测试不被 layout 实现破坏。

## 7. P3：VSCode 风格平台能力

### 目标

让 Latte 的内置功能和未来插件都能通过稳定的平台能力注册、激活和组合，而不是把功能硬编码进 app。

### 要做什么

1. ContextKeyService
   - `canvasFocus`、`selectionCount`、`activeTool`、`readonly`、`hasDocument` 等上下文键。
   - 菜单、快捷键、命令 enablement 统一基于 when clause。

2. ConfigurationService
   - workspace/user/default configuration。
   - schema、默认值、变更事件。
   - 快捷键、工具、渲染质量、实验开关可配置。

3. Contribution Registry
   - commands、menus、keybindings、tools、panels、inspect providers、export providers。
   - 内置功能也通过 contribution 注册，做到 everything is contribution。

4. Plugin manifest
   - manifest schema。
   - activation events。
   - capabilities/permissions。
   - contribution points。

5. Public extension API facade
   - `ctx.commands`、`ctx.selection`、`ctx.nodes`、`ctx.styles`、`ctx.workspace`。
   - 插件作者不直接拿内部 `editor.getService()` 和 raw service 实例。

### 为什么

VSCode 的强大不只是插件数量，而是它把菜单、命令、快捷键、配置、上下文和扩展宿主做成了可组合平台。Latte 若要成为 Figma + VSCode 的联合体，也需要这一层。

### 交付物

- ContextKey/Configuration/Contribution 的 syrup 实现和测试。
- 插件 manifest RFC 与 schema。
- 内置 counter contributions 迁移到 registry。

### 验收标准

- 新增工具不需要改 app 入口硬编码。
- 菜单和快捷键能根据 context 自动启用/隐藏。
- 插件 API 不泄漏内部 service 实例。

## 8. P4：设计语义系统

### 目标

补齐 Figma 类产品的核心设计语义：组件、变量、样式、资源、文本、矢量和库。

### 要做什么

1. Components / Instances / Variants
   - component definition、instance override、variant props。
   - detach、reset override、swap component。
   - instance 变更不直接复制全部节点。

2. Variables / Tokens
   - collection、mode、variable reference。
   - fill/stroke/text/layout spacing 可绑定 variable。
   - UI 与插件 API 都能读写变量。

3. Styles
   - paint/text/effect/grid style。
   - StyleService 与 VariableService 分层。
   - shared metadata 指针化存储。

4. Text / Vector / Boolean
   - 文本测量、字体加载、编辑态。
   - path/pen/vector network。
   - boolean operation 的派生几何缓存。

5. Libraries / Assets
   - team library、publish/update、asset import/export。
   - 本地文件 schema 与远程资源引用策略。

### 为什么

没有这些语义，Latte 只能是高性能画布，而不是设计工具平台。它们也是商业化功能、团队协作和插件生态的基础。

### 交付物

- ComponentService、VariableService、StyleService 完整版本。
- 文件 schema migration。
- UI panels 与插件 API。

### 验收标准

- 基础组件/实例/变量链路可创建、修改、保存、加载、撤销。
- 样式修改可被 renderer、面板、插件一致读取。
- 文件 schema 有版本迁移测试。

## 9. P5：插件宿主与安全边界

### 目标

让第三方扩展可以安全运行，同时不破坏 worker 权威写入、历史、协同和性能边界。

### 要做什么

1. Extension Host
   - iframe、worker 或独立 JS runtime 方案评估。
   - 插件生命周期：activate/deactivate/dispose。
   - 插件日志、错误、性能预算。

2. Permission model
   - document read/write、network、clipboard、storage、export、dev mode provider。
   - 用户授权和企业策略。

3. API stability
   - semver、deprecation、capabilities。
   - 内部 service 与 public API 隔离。
   - 插件不能获得 raw SAB 写权限。

4. Runtime validation
   - `@latte-js/schema` 引入 Zod。
   - manifest、external command、RPC payload、workspace config 校验。

### 为什么

插件生态是 VSCode 形态的核心，但插件也是最大的安全、性能和维护风险。必须先有稳定 facade、权限和 runtime validation，再开放第三方能力。

### 交付物

- 第一版 extension host。
- Public API 文档。
- 插件示例和测试夹具。

### 验收标准

- 插件可注册命令/菜单/工具/panel。
- 插件写入 document 必须经过 service/RPC/worker。
- 插件异常不会拖垮 editor runtime。

## 10. P6：Dev Mode、导出与开发者体验

### 目标

让 Latte 不只是能设计，还能把设计转化为开发者可消费的信息与资产。

### 要做什么

1. Inspect / Dev Mode
   - 节点尺寸、间距、颜色、字体、变量、组件来源。
   - CSS/React/Design Token codegen provider。
   - 测量 overlay 与 selection inspect。

2. Export
   - PNG/SVG/PDF/JSON。
   - asset slicing。
   - batch export。
   - renderer backend 能力差异降级。

3. Automation
   - headless render。
   - AI layout/codegen agent 接口。
   - CLI 或 Node runtime。

### 为什么

商业设计工具的重要价值在于设计到研发的闭环。Dev Mode、导出和自动化也会推动 Latte 的开发者定位。

### 交付物

- InspectService、ExportService、CodegenProvider。
- headless smoke。
- 导出回归测试。

### 验收标准

- 选中节点能生成稳定 inspect 数据。
- 基础资产导出可测试。
- headless 场景不依赖 DOM-only runtime。

## 11. P7：协同、版本与生产化

### 目标

把单机编辑器内核升级为多人、团队、可部署的生产系统。

### 要做什么

1. Collaboration journal
   - command journal 或 normalized mutation record。
   - scene version、client id、operation id。
   - deterministic replay。

2. Snapshot/checkpoint
   - document snapshot。
   - incremental patch。
   - recovery 和 corruption guard。

3. Conflict policy
   - 节点字段冲突。
   - selection/presence。
   - component/library update conflict。

4. Comments / Version history
   - comment anchors。
   - named versions。
   - restore/version diff。

5. Production deployment
   - COOP/COEP 模板。
   - SaaS/self-host health check。
   - telemetry 和 privacy policy。
   - performance benchmark dashboard。

### 为什么

协同不是“把 SAB 同步出去”那么简单。它依赖可序列化、可回放、可冲突处理的语义记录。P7 要在前面 history、schema、service、projection 稳定后再推进。

### 交付物

- collaboration RFC。
- 本地多客户端模拟测试。
- 生产部署文档和性能基线。

### 验收标准

- 多客户端 replay 结果一致。
- 快照恢复可靠。
- 协同不会破坏本地 undo/redo 语义。

## 12. P8：Rust/WASM native engine 评估

### 目标

在 TypeScript 架构边界稳定、性能基线可重复之后，评估是否引入 Rust/WASM 内核承接真正必要的性能和存储热路径。

### 要做什么

1. 性能基线先行
   - 大文档 load/serialize。
   - Matrix/AABB 批量 tick。
   - vector/path/boolean 几何。
   - snapshot/diff/history replay。
   - shared blob 写入、释放、compaction 需求。

2. Native boundary RFC
   - 设计 `@latte-js/native` 或 worker 内部 Rust crate 的封装边界。
   - 明确 JS fallback、WASM feature detection、版本兼容和 debug source map。
   - 保证外部仍只看 service/RPC、SceneGraph/NodeCursor、projection contract。

3. Rust/WASM 候选模块
   - shared blob allocator / compaction / binary metadata store。
   - Matrix/AABB/layout 批量计算。
   - vector network、boolean operation、path flattening。
   - snapshot/diff、history replay、collaboration journal normalization。

4. 发布和部署
   - npm wasm artifact 策略。
   - CI build/cache。
   - browser COOP/COEP、worker 初始化和 fallback。
   - 商业授权和 AGPL 源码分发边界。

### 为什么

Rust/WASM 可以成为 Latte 的长期性能护城河，但只有在语义层稳定后才值得引入。否则 native 层会把尚未确定的数据结构、history 和 layout 规则固化得太早。

### 验收标准

- 至少一个基准证明 Rust/WASM 明显优于 JS 实现，且收益覆盖复杂度。
- JS fallback 保持可运行。
- 插件、主线程和 UI 仍无法绕过 worker 权威写入。
- native 模块失败时 editor runtime 有可观测错误和降级策略。

## 13. 包职责演进

| 包                   | 长期职责                                                                                    | 许可证策略                     |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| `@latte-js/bean`     | 类型、RPC contract、文件 schema 类型、公共 enum                                             | MIT，未来可评估 Apache-2.0     |
| `@latte-js/schema`   | 未来新增，Zod schemas、manifest/file/config validation、migration validation                | MIT 或 Apache-2.0              |
| `@latte-js/espresso` | SAB/SoA 数据内核、SceneGraph、NodeCursor、Loader/Serializer、临时 shared heap/blob contract | AGPL-3.0-or-later + commercial |
| `@latte-js/barista`  | worker services/systems、MutationGate、TransactionManager、HistoryManager、UndoRedoService、native compute bridge | AGPL-3.0-or-later + commercial |
| `@latte-js/native`   | 未来可选，Rust/WASM 存储、几何、snapshot/diff、replay 热路径                                | AGPL-3.0-or-later + commercial |
| `@latte-js/crema`    | editor runtime assembly、worker client、projection sync、interaction controller             | AGPL-3.0-or-later + commercial |
| `@latte-js/art`      | renderer、camera、hit test、RTree、render backends                                          | AGPL-3.0-or-later + commercial |
| `@latte-js/syrup`    | main-thread platform、DI、commands、menus、keybindings、input、future contribution registry | MIT                            |
| `@latte-js/counter`  | built-in workbench/contrib、tools、selection、built-in commands                             | AGPL-3.0-or-later + commercial |
| `@latte-js/milk`     | React UI components and panels                                                              | MIT                            |
| `@latte-js/kit`      | shared runtime utilities                                                                    | MIT                            |
| `apps/cafe`          | integration demo and smoke target                                                           | UNLICENSED demo app            |

## 14. 暂缓项

以下事项不是方向错误，但需要等待前置边界稳定：

- 主线程直接写 document model。
- 完整 worker-side SelectionContext。
- delete/reparent 没有快照前进入 history。
- 全项目热路径 Zod 校验。
- 插件 raw SAB 访问。
- 协同编辑。
- shared heap grow/compaction protocol。
- 多后端渲染大重构。
- 立即 Rust/WASM 迁移。

## 15. Review Checklist

每个 PR 至少检查：

- [ ] 主线程没有新增 document model 写入。
- [ ] 写入经过 worker Service/System/NodeCursor。
- [ ] mutation policy 覆盖新增 service/system 方法。
- [ ] undo/redo replay 没有绕过 NodeCursor。
- [ ] projection sync 的 ID map、dirty/version、graph reset 可解释。
- [ ] metadata 不再依赖 private Map 作为权威来源。
- [ ] selection 没有污染 document graph。
- [ ] transform/layout 测试验证视觉角点或明确布局结果。
- [ ] 新增外部输入边界有 runtime validation 计划或实现。
- [ ] Rust/WASM 相关改动没有绕开 worker service、NodeCursor 和 projection contract。
- [ ] README、package README、license、contribution docs 与实际架构一致。

## 16. 参考依据

VSCode 平台模型：

- Extension Anatomy：<https://code.visualstudio.com/api/get-started/extension-anatomy>
- Contribution Points：<https://code.visualstudio.com/api/references/contribution-points>
- When Clause Contexts：<https://code.visualstudio.com/api/references/when-clause-contexts>
- Extension Host：<https://code.visualstudio.com/api/advanced-topics/extension-host>
- Language Server Guide：<https://code.visualstudio.com/api/language-extensions/language-server-extension-guide>

Figma 设计语义：

- Plugin API：<https://developers.figma.com/docs/plugins/>
- Plugin Manifest：<https://developers.figma.com/docs/plugins/manifest/>
- Components：<https://help.figma.com/hc/en-us/articles/360038662654-Guide-to-components-in-Figma>
- Variables：<https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes>
- Auto Layout：<https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties>
- Constraints：<https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize>
- Position Panel：<https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-and-position>
- `relativeTransform`：<https://developers.figma.com/docs/plugins/api/properties/nodes-relativetransform/>
- Resize API：<https://developers.figma.com/docs/plugins/api/properties/nodes-resize/>
