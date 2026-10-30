# Latte 全量 Review 路线图

> 日期：2026-10-30；审查分支：`codex/development`。
>
> 本文给出本轮单文档编辑闭环的验收路径，以及覆盖整个仓库的代码阅读顺序。本轮最终本地 release gate 已通过，包含末轮 review 发现的 resize 兄弟子树快照与属性失焦点击修复，结果见第 4 节。全量人工 review 的检查框由审查者逐项记录，自动化通过不替代人工确认。
>
> 下列文件路径均相对于仓库根目录。建议先走通产品，再沿一条编辑链路追踪实现，最后讨论下一阶段架构。

配套阅读：[本轮发现与后续问题清单](./review-findings.zh-CN.md)。该清单区分本轮已有修复、尚待集成复现的路径缺口和后续工程债，方便把 review 结论直接转成任务。

**CI 追补（2026-10-30）：** 首批交付 `82bacb7` 的 Ubuntu / Node 20 单测暴露了公共工具包导入时直接读取 `navigator` 的兼容问题。本地 Node 22 自带该对象，因此原先的本地门禁没有暴露故障。后续修复与新验证见 [CI 后续修复](./review-findings.zh-CN.md#ci-后续修复2026-10-30)；下文四阶段提交仍保留为首批实现的阅读映射，review 当前版本时还应检查 `git diff 82bacb7..HEAD -- packages/kit/src/platform`。

## 1. Review 前固定基线

在仓库根目录记录以下结果，避免把远程旧版、构建缓存和本地未提交内容混为一个版本：

```powershell
git status --short --branch
git rev-parse HEAD
git log -8 --oneline
git rev-list --left-right --count origin/main...HEAD
node --version
pnpm --version
```

持续开发使用 `codex/development`；阶段成果形成独立提交。本轮先交付开发分支供用户全量 review，review 后再决定经 PR 合并远程 `main`，本轮不直接合并 main。本地 `main` 的位置不能替代远程 PR 或 CI 状态。远程引用已刷新；后续读取远程差异前仍需确认引用新鲜度。

**实现比较基线：`a69c5ccfbf22d304399b0d6854707afcfbfc89aa`；实现审查终点：`26905d1883e96d1f02ba1cb4d9843c4072868c90`。** 基线是本轮开发前的版本，不包含本轮属性面板、文件回环和修复。实现已经按下表提交；本轮最终门禁运行于该实现终点及配套 CI/release-gate 改动。文档、CI 与门禁脚本另作配套提交，后续文档提交不改变本节固定的实现比较范围。

```powershell
git diff --stat a69c5cc..26905d1
git diff a69c5cc..26905d1
```

| 阶段提交 | Review 重点 | 对应阅读站 |
| --- | --- | --- |
| `93454f8` · `fix(kit): make linked-list cleanup safe and repeatable` | clear 哨兵循环、重复清理、旧 disposer、自退订迭代 | 第 1、10 站 |
| `fc46198` · `feat(core): add atomic style edits and reliable document roundtrips` | 原子创建/样式、Worker session 订阅、Float32 边界、IO 字段回环、resize 全子树快照 | 第 3、4、5、9 站 |
| `a3a28eb` · `fix(editor): harden pointer sessions projection and layer opacity` | 指针交互收尾、projection guard/生命周期刷新、透明度离屏合成 | 第 2、3、6、7、8 站 |
| `26905d1` · `feat(cafe): complete the single-document editing workflow` | 属性适配器/面板、导入校验、独立 runtime 替换、历史/保存 UI、blur 后工具栏动作排队与 E2E | 第 1、9 站及产品操作表 |

先读 [README.zh-CN.md](../README.zh-CN.md) 的包职责表，再把 [长期路线图](./roadmap.zh-CN.md) 当作目标参照。文档中的“将来支持”与运行中的能力分开记录。

每一轮 review 都产出三样东西：可复现的问题、需要决定的产品语义、带验收条件的后续任务。不要仅用代码量或模块数量判断完成度。

## 2. 第一轮：从用户操作验收闭环

启动 Cafe：

```powershell
pnpm install --frozen-lockfile
pnpm --filter @latte-js/cafe dev
```

打开终端显示的本地地址。审查时同时观察画布、属性面板、浏览器控制台以及保存的 JSON。

| 顺序 | 操作 | 必须观察的结果 |
| --- | --- | --- |
| 1 | 首屏加载样例 | 一个可见画布；无未处理异常；`crossOriginIsolated` 为 `true`，`SharedArrayBuffer` 可用 |
| 2 | 激活矩形工具并创建节点 | 新矩形出现在点击位置，自动选中；节点有稳定 ID，并挂到正确页面 |
| 3 | 切回选择工具，点选、点空白、修饰键多选 | 面板、选中数量和覆盖层一致；多选面板的能力边界明确 |
| 4 | 拖动矩形，拖出画布后释放，再快速连续拖动 | 最终位置正确；释放后不再跟随鼠标；下一次操作能继续；一次拖动形成一次用户历史 |
| 5 | 修改 X、Y、宽、高 | X/Y 是世界坐标，宽/高是矩形本地尺寸；缩放视图不改变输入语义；零、负数、空值和非数值处理明确 |
| 6 | 修改名称、纯色填充、透明度 | 面板和画布同步；名称这样的非绘制属性也刷新；0%/100% 边界正确 |
| 7 | 按操作顺序撤销、重做 | 分别恢复创建、拖动、几何和样式；一次撤销不遗留看不见的孤立节点；撤销后新编辑清空 redo |
| 8 | 编辑属性后不按 Enter，直接点一次 Save JSON；继续修改，再加载刚保存的文件 | 属性草稿先提交，保存动作不被失焦/busy 状态吞掉；JSON 包含刚输入值，加载后 ID、层级、位置、尺寸、名称和基础样式恢复，不混入后加节点 |
| 9 | 连续加载两次、导入无效文件 | 无重复图层；失败可见且原文档仍可使用；未提交输入与异步操作状态明确 |
| 10 | 保存→加载→再保存，比较语义 | 比较节点、父子关系和属性；忽略 JSON 空白、键顺序等格式差异；选区、相机、历史是否保存要有明确约定 |

单独记录限制：最小纯色面板不等于完整 Paint 编辑器；矩形回环不等于所有 schema 节点均无损；底层多文档 API 不等于已交付多文档产品。框选、旋转/缩放手柄、完整图层树、stroke、渐变、文本、布局和插件分别验收。

主要入口：[Cafe App](../apps/cafe/src/app.tsx)、[属性面板](../apps/cafe/src/propertyPanel.tsx)、[样例文档](../apps/cafe/src/assets/sample.json)、[启动/创建测试](../e2e/cafe-smoke.spec.ts)、[完整编辑与文件回环测试](../e2e/editor-loop.spec.ts)。先对照这些用例，再看测试是否真的断言了最终位置、颜色、透明度像素和保存内容，而不只断言“按钮可点击”。

## 3. 第二轮：按执行链路阅读代码

### 第 1 站：产品 UI 与运行时装配

阅读顺序：[Cafe App](../apps/cafe/src/app.tsx) → [PropertyPanel](../apps/cafe/src/propertyPanel.tsx) → [EditorSessionController](../packages/crema/src/editing/editorSessionController.ts) → [EditorRuntime](../packages/crema/src/editorRuntime.ts) → [EditorHost](../packages/syrup/src/core/editorHost.ts) → [DocumentViewStateController](../packages/crema/src/document/documentViewStateController.ts)。

检查：

- UI 是否只读选区/projection，通过服务表达修改；React state 是否只是输入草稿与界面状态。
- Worker、消息端口、canvas、ResizeObserver、订阅、工具和 renderer 的创建/释放是否对称。
- startup 未完成就卸载、重复启动、导入失败与切换文档时，是否留下失效 runtime 或事件监听。
- 运行时切换会触发 emitter/listener 清理；本轮修复 `LinkedList.clear` 将对象哨兵当作 truthy 节点而无法退出的循环。检查空/单/多节点反复 clear、旧 disposer 在 clear 后调用、自退订时后续 listener 仍能收到事件。
- 面板异步操作是否固定目标文档/选中 ID，防止等待 RPC 时用户切换对象后写错文档。
- 属性输入的 `blur` 会先于工具栏 `click`；核对草稿提交触发 busy 后是否使 Save/Undo/工具切换丢失该次点击。属性与工具栏动作应按明确顺序完成，直接点一次 Save 就保存最新输入，不能依赖用户先按 Enter 或重试点击。
- `EditorSessionController` 的 snapshot/修改/undo/redo/save 是否提供稳定的界面适配，React 不应自己遍历写入内核。
- `EditorRuntime` 是装配入口，`EditorHost` 是实例作用域；临时 `getService` 注册不能直接当成稳定插件 API。

本阶段 UI 可以先在 Cafe 验证消费者需求；何时把可复用组件移入 `milk`，应在这条真实链路稳定后决定。

### 第 2 站：工具、选择和输入分发

阅读顺序：[Workbench](../packages/counter/src/workbench.ts) → [ToolService](../packages/counter/src/services/tools/toolService.ts) → [RectangleTool](../packages/counter/src/contrib/rectangle/rectangleTool.ts) → [SelectionTool](../packages/counter/src/contrib/select/selectionTool.ts) → [InputService](../packages/syrup/src/services/input/inputService.ts) → [RendererHitTestService](../packages/crema/src/input/rendererHitTestService.ts)。

检查：

- 工具激活与选择工具的优先级、事件消费、左键/右键、中断操作和快捷键焦点是否一致。
- viewport、world、parent-local 坐标在哪里转换；面板位置与鼠标拖动的坐标语义是否相容。
- 内部分发捕获与浏览器原生 pointer capture 是否都处理；画布外释放、`pointercancel`、丢失捕获如何收尾。
- 选区属于 UI/session 状态；删除、撤销创建、加载、换文档后不能保留不存在的节点 ID。
- 创建并挂载节点是否为一次原子操作；父页面创建、节点创建、挂载失败时的历史和回滚是否完整。

对照测试：[SelectionTool 测试](../packages/counter/src/contrib/select/__test__/selectionTool.test.ts)、[InputService 测试](../packages/syrup/src/services/__test__/inputService.test.ts)、[Workbench 测试](../packages/counter/src/__test__/workbench.test.ts)。

### 第 3 站：高频交互和属性提交

阅读：[TransformInteractionController](../packages/crema/src/interactions/transformInteractionController.ts)、[Transform RPC](../packages/bean/src/rpc/transform.ts)、[TransformService](../packages/barista/src/services/transform.ts)、[TransformSystem](../packages/barista/src/systems/transform.ts)、[Style RPC](../packages/bean/src/rpc/style.ts)、[StyleService](../packages/barista/src/services/style.ts)。

检查：

- 拖动发送的是相对 session 初始快照的总位移，不能把总位移逐帧相加。
- resize session 同样基于 begin 时的全子树快照：父级宽从 100→200→150 时，所有兄弟子树都应使用原尺寸/位置按最终 1.5 倍计算，不能只捕获首个子链而让其他兄弟按中间结果重复缩放。核对 `_collectDescendantIds` 遍历覆盖全部子孙以及 commit/cancel/undo/redo。
- RAF 合并只丢弃中间目标，pointerup 的最后目标必须被确认后再 commit。
- begin 尚未返回就 release/cancel、commit 失败、快速开启下一操作、dispose 时的状态都要有回归测试。
- 手动属性输入一次提交对应一次原子历史；若以后加 scrub/拖动数值，再定义 begin/update/commit，避免每帧一条历史。
- StyleService 先校验全部目标与 patch，再写 NodeCursor；批量修改某个节点失败时不能留下前半批结果。
- 几何数据实际写入 Float32Array；JavaScript `Number.isFinite` 不足以拦住 `1e40`。核对 UI、创建与 TransformSystem 都限制 Float32 可表示范围，失败不得改变数据或历史。
- `resize` 的自由变换语义与将来的 Frame/constraints/auto layout 分开；本阶段不能由尺寸输入暗中承诺完整布局规则。

重点测试：[TransformInteractionController 测试](../packages/crema/src/interactions/__test__/transformInteractionController.test.ts)、[TransformService/历史集成测试](../packages/barista/src/services/__test__/transformServiceTransactions.test.ts)、[StyleService 测试](../packages/barista/src/services/__test__/styleService.test.ts)。

### 第 4 站：RPC、会话与错误边界

阅读顺序：[Channels 与 IServiceMap](../packages/bean/src/rpc/services.ts) → [BaristaClient](../packages/barista/src/client/baristaClient.ts) → [ChannelClient](../packages/barista/src/ipc/channelClient.ts) → [ChannelServer](../packages/barista/src/ipc/channelServer.ts) → [proxyChannel](../packages/barista/src/ipc/proxyChannel.ts) → [BaristaEngine](../packages/barista/src/worker/baristaEngine.ts) → [BaristaSessionManager](../packages/barista/src/worker/baristaSessionManager.ts)。

检查：

- TypeScript 接口不等于运行时校验；未知方法、无效 session、协议版本、错误 payload 的处理是否清楚。
- 未指定 session 的动态代理和固定 session 代理，分别适合什么生命周期；异步调用能否串到新活动文档。
- Request 的失败如何到达 UI；Notification 的失败如何暴露；不能只有 console.error 就视为用户已知。
- 消息串行队列、事务会话和 worker context stack 的关系；多文档交错请求不会读错 context。
- 事件工厂返回与真正注册 listener 是两个时刻；本轮修正 `BaristaEngine.listen`，将实际订阅也放进目标 session context。复核创建通知能更新该文档的 projection ID-map，A/B/default session 隔离，且 unlisten 确实释放订阅。
- Worker 异常退出、超时、取消、消息端口释放和 session 关闭，目前哪些已实现、哪些仍缺。

先运行 [ChannelServer 测试](../packages/barista/src/ipc/__test__/channelServer.test.ts) 和 [BaristaEngine 测试](../packages/barista/src/worker/__test__/baristaEngine.test.ts)，再根据缺口增加场景。单元测试中的服务调用不替代真实 Worker E2E。

### 第 5 站：写入权威、事务与历史

阅读顺序：[serviceBase](../packages/barista/src/services/serviceBase.ts) → [serviceAudit](../packages/barista/src/services/serviceAudit.ts) → [MutationGate](../packages/barista/src/transactions/mutationPolicy.ts) → [TransactionManager](../packages/barista/src/transactions/transactionManager.ts) → [HistoryManager](../packages/barista/src/history/historyManager.ts) → [MutationRecordApplier](../packages/barista/src/history/mutationRecordApplier.ts) → [SceneGraphMutationWriter](../packages/barista/src/mutations/sceneGraphMutationWriter.ts)。

检查：

- 每个 RPC 可调用方法都有明确 policy：Readonly、Atomic、Session 或有理由的 WriteNoHistory。
- transaction 管记录生命周期，history 管已提交用户操作；两者不要因 UI 接线重新混在一起。
- 无效输入、半途异常、取消和空修改是否生成历史；失败能否恢复数据、dirty 和相关状态。
- undo/redo 使用同一 mutation 应用路径；create/delete/reparent 的 ID、兄弟顺序、tombstone 与 redo 清理正确。
- 优先补 `NodeService.deleteNode → undo → redo` 的跨 Worker/projection 场景：显式删除会移除主线程 ID-map，历史重放恢复 tombstone 的路径目前没有对应 NodeSystem 创建通知。当前 Cafe 尚无删除入口，不应据此推断底层删除闭环已经可用。
- 历史按 resource/session 隔离；导入替换文档后，旧历史是否清空或另建 session；保存是否包含历史必须明确。
- 事务记录保存值的快照，不能引用调用方之后还能修改的数组或 Paint 对象。

重点测试：[Mutation policy 覆盖](../packages/barista/src/services/__test__/serviceMutationPolicy.test.ts)、[TransactionManager](../packages/barista/src/transactions/__test__/transactionManager.test.ts)、[HistoryManager](../packages/barista/src/history/__test__/historyManager.test.ts)。

### 第 6 站：SharedArrayBuffer / SoA 数据内核

阅读顺序：[memoryLayout](../packages/espresso/src/data/memoryLayout.ts) → [SceneGraph](../packages/espresso/src/data/sceneGraph.ts) → [NodeCursor](../packages/espresso/src/data/nodeCursor.ts) → [mutationAuthority](../packages/espresso/src/data/mutationAuthority.ts) → [Allocator](../packages/espresso/src/data/allocator.ts) → [HeapManager](../packages/espresso/src/data/heapManager.ts) → [BlobManager](../packages/espresso/src/data/blobManager.ts) → [nodeProps](../packages/espresso/src/data/nodeProps.ts)。

检查：

- 本轮 runtime 对内核和文档 graph 调用 `projection.protectGraph`，启用 mutation guard；ID-map 同步只在受控 `WriteNoHistory` scope 中进行。审查新增 graph 是否也经过这条入口，并用测试断言 NodeCursor/结构写入被拒绝。
- `readonly` 属性不等于 TypedArray 元素不可写；公开 raw graph/SAB 是内部信任边界，未来插件不能直接取得它们。
- 主线程只更新允许的 ID 映射和 projection 读回；新增 document 写入口必须由测试捕获。
- ID↔index、generation、Free/Active/Tombstone 及飞行光标在删除/撤销/复用时的语义正确。
- name/fill/stroke 的 blob 指针共享，但对象缓存按线程存在；指针替换、旧缓存和 JSON 快照不能互相污染。
- 堆采用追加/tombstone 时的内存增长、容量限制和超限行为明确；替换 SAB 后主线程/Worker 能否一起获知新 buffer，不能依赖单线程测试推断。

重点测试：[SceneGraph](../packages/espresso/src/data/__test__/sceneGraph.test.ts)、[NodeCursor](../packages/espresso/src/data/__test__/nodeCursor.test.ts)、[BlobManager](../packages/espresso/src/data/__test__/blobManager.test.ts)。

### 第 7 站：派生数据、投影与 UI 一致性

阅读顺序：[DirtyBatch](../packages/barista/src/pipeline/dirtyBatch.ts) → [PipelineRunner](../packages/barista/src/pipeline/pipelineRunner.ts) → [MatrixSystem](../packages/barista/src/systems/matrix.ts) → [AABBSystem](../packages/barista/src/systems/aabb.ts) → [NotificationPlanner](../packages/barista/src/pipeline/notificationPlanner.ts) → [ProjectionSyncController](../packages/crema/src/projection/projectionSyncController.ts) → [RenderInvalidationController](../packages/crema/src/render/renderInvalidationController.ts)。

检查：

- source matrix/size 与 derived worldMatrix/AABB 的新鲜度边界，RPC 返回、query、save、通知和 render 前各有什么保证。
- Matrix 与 AABB 的写入职责唯一；parent transform/reparent 会正确更新后代与祖先 bounds。
- renderIds 与 affectedIds 不同：名称/锁定等 metadata 修改也要驱动属性面板刷新。
- 面板订阅新的 `onDidChange`：load/create/delete/dirty 在更新 ID-map 和 version 后通知 UI；`onDidMarkDirty` 仍服务绘制/dirty 消费者。检查生命周期变化是否只刷新画布而漏掉选区与属性。
- worker projection version、主线程本地 version、ID map 更新和绘制调度各自代表什么，不能只比较一个递增数字。
- 换文档后旧 listener 及时解绑；loaded/deleted/recreated 节点不会保留旧选区、索引或相机状态。
- SAB 中多列值与 blob 指针的读取一致性靠什么保证；当前没有实现的并发快照承诺要保留为限制。

对照 [ProjectionSync 测试](../packages/crema/src/projection/__test__/projectionSyncController.test.ts)、[MatrixSystem 测试](../packages/barista/src/systems/__test__/matrixSystem.test.ts)、[AABBSystem 测试](../packages/barista/src/systems/__test__/aabbSystem.test.ts)。

### 第 8 站：渲染、命中与选择覆盖层

阅读顺序：[Renderer](../packages/art/src/core/render.ts) → [RenderScheduler](../packages/art/src/core/renderScheduler.ts) → [SceneRenderLayer](../packages/art/src/core/sceneRenderLayer.ts) → [RenderSceneIndex](../packages/art/src/core/renderSceneIndex.ts) → [RenderFrameBuilder](../packages/art/src/core/renderFrameBuilder.ts) → [RenderCommandEncoder](../packages/art/src/core/renderCommandEncoder.ts) → [Canvas2DBackend](../packages/art/src/render/canvas/canvas2DBackend.ts) → [HitTester](../packages/art/src/interaction/hitTester.ts) → [SelectionOverlayLayer](../packages/counter/src/overlay/selectionOverlayLayer.ts)。

检查：

- renderer 与 hit test 读取同一 projection/变换；绘制顺序、隐藏/锁定语义、active page 和选区几何一致。
- scene index 在 create/delete/reparent/undo/load 后更新，不能只全量重建时正确。
- 相机缩放、DPR、旋转父级、嵌套组和透明度叠加的视觉结果符合约定。
- 本轮透明度由 encoder 保留祖先 `PushLayer/Pop` 层级，Canvas2D 使用离屏合成；同组重叠子图形应先合成，再应用组透明度。核对 paint alpha 不覆盖 layer alpha，嵌套组和 0%/100% 均正确。
- RenderScheduler 合并请求不会漏绘，空闲时不重复编码整场景；性能结论需帧耗时/节点数基线。
- 透明度离屏 surface 当前按完整 viewport 分配并池化；高 DPR、深层透明组的内存/带宽峰值仍需测量，再决定边界裁剪或池容量策略。
- Canvas2D 是本阶段可运行后端；接口中有其他后端类型不代表已实现且可发布。

对照 [RenderSceneIndex 测试](../packages/art/src/core/__test__/renderSceneIndex.test.ts)、[SceneRenderLayer 测试](../packages/art/src/core/__test__/sceneRenderLayer.test.ts)、[透明度编码测试](../packages/art/src/core/__test__/renderCommandEncoder.test.ts)、[Canvas2D 合成测试](../packages/art/src/render/canvas/__test__/canvas2DOpacity.test.ts)、[选择几何测试](../packages/counter/src/overlay/__test__/selectionOverlayGeometry.test.ts)。

### 第 9 站：文件格式与保存/加载

阅读顺序：[Cafe 文件入口](../apps/cafe/src/app.tsx) → [validateDocument](../packages/crema/src/document/validateDocument.ts) → [ILatteFile/节点 schema](../packages/bean/src/schema/v1/nodes.ts) → [Document RPC](../packages/bean/src/rpc/document.ts) → [DocumentService](../packages/barista/src/services/document.ts) → [LatteLoader](../packages/espresso/src/io/latteLoader.ts) → [Serializer](../packages/espresso/src/io/serializer.ts) → [nodeSnapshot](../packages/espresso/src/data/nodeSnapshot.ts)。

检查：

- UI 文件导入最终是替换、合并还是创建新文档；底层 loader 的 upsert 行为不能冒充“完整替换”。
- 本轮 Cafe 的替换方案是先在独立 runtime/Worker 与 staging 画布加载，成功后切换并释放旧 runtime。核对失败清理、成功切换、内存峰值和是否复用了旧历史；这不是原地 load 的事务回滚。
- 导入前校验 root/page、重复 ID、缺失父节点、循环、非法尺寸/矩阵/颜色及未知节点类型；失败不损伤当前文档。
- 新建页面、节点顺序、基础样式、名称、透明度和稳定 ID 能回环。
- 椭圆、圆角、page background、渐变、图片、文本与未知字段分别核对 serializer/loader 映射；schema 声明不能充当无损支持清单。
- 文件 schema 版本、迁移、资源引用、体积限制和错误提示如何演进；当前 JSON demo 文件不等于稳定公开格式。
- 浏览器下载/上传、内部 `save()` 和服务器持久化是不同能力；本轮支持范围需要明确。

本轮导入边界应对照 `validateDocument` 逐项复核：支持 DOCUMENT/CANVAS/FRAME/GROUP/RECTANGLE/ELLIPSE；纯色与渐变 Paint 可导入，legacy Paint blend 字符串会在 loader 中规范化。TEXT/PATH/CIRCLE 等未接通绘制的节点、没有资源持久化链路的 IMAGE Paint、非默认 layer blend、非零 corner smoothing 和非均匀各边 stroke 当前会明确拒绝。椭圆 fills、Canvas 背景和矩形四角的文件回环有独立回归测试；可保存字段仍不等于已有可见的对应绘制功能。

对照 [Loader 测试](../packages/espresso/src/io/__test__/latteLoader.test.ts)、[Serializer 测试](../packages/espresso/src/io/__test__/serializer.test.ts)、[字段回环测试](../packages/espresso/src/io/__test__/serializerRoundtrip.test.ts)、[导入校验测试](../packages/crema/src/document/__test__/validateDocument.test.ts) 以及真实保存/导入 E2E。

### 第 10 站：工程质量、包消费与治理

阅读：[package.json](../package.json)、[pnpm-workspace.yaml](../pnpm-workspace.yaml)、[turbo.json](../turbo.json)、[vitest.config.mts](../vitest.config.mts)、[playwright.config.ts](../playwright.config.ts)、[release-gate](../scripts/release-gate.mjs)、[CI](../.github/workflows/ci.yml)、[license 检查](../scripts/check-licenses.mjs)、[贡献指南](../CONTRIBUTING.zh-CN.md)、[治理与授权](./governance-and-licensing.zh-CN.md)、[SECURITY](../SECURITY.md)。

补看公共基础层：[kit lifecycle](../packages/kit/src/lifecycle.ts)、[kit event](../packages/kit/src/event/event.ts)、[LinkedList](../packages/kit/src/linkedList/linkedList.ts)、[链表清理/退订回归测试](../packages/kit/src/linkedList/__test__/linkedList.test.ts)、[CommandService](../packages/syrup/src/services/command/commandService.ts)、[KeybindingService](../packages/syrup/src/services/keybinding/keybindingService.ts)、[InstantiationService](../packages/syrup/src/services/instantiation/instantiationService.ts)。核对订阅可释放、全局 registry 的实例隔离、输入焦点与命令作用域；已有原型仍需真实消费者证明其 API 合理。

检查：

- 本地 release gate 与 CI 的范围是否相同；只构建 Cafe 不能替代全部包构建。开发分支 push、PR 和 tag 各触发哪些验证/部署。
- 本轮 release gate 已改为 workspace 全量 build；CI 已加入 `codex/development` push。核对实际运行结果、PR 对象和生产部署条件，代码配置不等于云端已通过。
- 根级 Vitest 实际发现哪些测试；coverage 未配置全源码 include 时，未导入文件可能不在分母中。语句/分支覆盖率不是全仓正确率。
- 现有 E2E 用例、浏览器范围、断言内容和测试环境都要列明；mock 单测不证明 Worker/共享内存链路。
- Node engines、CI Node 和 Vite/Vitest 的最低运行版本一致；固定 pnpm、native TypeScript preview 和其他关键工具版本。
- audit 是阻断还是警告；区分运行时、开发服务器和构建链依赖漏洞，修复后再跑门禁。
- 包的 source exports、dist、publishConfig、CJS/ESM、types 和 worker 资源引用一致；追加 `pnpm pack` 后在外部最小消费者中安装验证，不能只靠 monorepo aliases。
- SAB 依赖跨源隔离；Vite 开发服务器的 COOP/COEP 不会自动带进静态产物。生产托管/CDN/嵌入页面需核对实际响应头、Worker 启动和 `crossOriginIsolated`，部署 workflow 不能替代生产验证。
- `AGPL-3.0-or-later`、MIT、Cafe UNLICENSED 与商业授权说明一致；license 脚本只验元数据/文本，不能替代依赖许可证评估。

## 4. 验证命令与证据记录

复现本轮验证使用以下命令；release gate 已包含 workspace build，单独 `pnpm build` 适用于只复查构建时。新失败修复后只重跑有必要的相关检查及最终门禁：

```powershell
pnpm release:check
pnpm test:coverage
pnpm audit --audit-level=high
git diff --check
```

| 证据 | 记录内容 |
| --- | --- |
| 最终版本 | commit、分支、工作区状态、是否已 push、PR/CI 链接 |
| release gate | 各步 pass/fail，不能只引用历史运行 |
| 全包构建 | 成功任务数、缓存使用、失败包 |
| 单测/E2E | 测试文件/用例数、浏览器、关键场景断言 |
| coverage | 语句/分支/函数/行，包含范围与未覆盖高风险路径 |
| audit | 日期、严重级别、受影响依赖路径、是否可达、修复安排 |
| 手工验收 | 上述操作表的通过/失败/未验，以及具体重现步骤 |

**2026-10-30 最终验证记录：** 实现终点为 `26905d1`，末轮 resize 兄弟子树快照与属性失焦点击修复均包含在本次门禁内。

| 检查 | 实际结果 | 范围/限制 |
| --- | --- | --- |
| `pnpm release:check` | 通过，110.8 秒 | license、lint、type-check、单测、workspace build、Chromium E2E、diff 检查全部通过 |
| Vitest | 59 个测试文件、446 个测试通过 | 根级测试发现范围；含链表清理/退订、session 订阅、projection 与 resize 兄弟子树快照回归 |
| workspace build | 10/10 构建任务通过，31.536 秒、零缓存命中 | 全工作区构建；外部 pack 消费另行验收 |
| Chromium E2E | 6/6 通过，43.6 秒 | 启动、矩形创建、完整编辑/文件回环、错误输入、透明度真实像素及 undo、属性草稿直接 Save/Undo；未宣称其他浏览器通过 |
| `pnpm test:coverage` | 通过，59 文件/446 测试 | Statements 73.79%（4908/6651）、Branches 61.94%（1771/2859）、Functions 73.23%（952/1300）、Lines 74.14%（4776/6441） |
| 云端 CI/生产部署 | 本轮未以本地门禁代替验证 | 需在 push 后核对实际 CI；生产 COOP/COEP 与外部 SDK 消费仍列为后续项 |

覆盖率分母受当前 Vitest 配置约束：没有显式全源码 include，未被测试导入的文件可能未纳入。上述百分比只描述本次被采集文件，不能解释为“全仓已有约 74% 正确”。本地耗时也是本机本次运行记录，不是性能基准或 CI 用时承诺。

历史参照只用于发现回归：2026-10-28 基线曾通过 55 个单测文件/361 个测试、2 条 Chromium E2E；覆盖率语句 68.8%、分支 53.58%。这些是旧基线数据，本轮门禁结果以上表为准。

2026-10-30 已重新运行 `pnpm audit --json`：本轮仍为 81 项（1 critical、42 high、33 moderate、5 low），原始本地证据保存在未纳入版本管理的 `.git/latte-review-audit.json`。critical 路径为 `packages__crema>vitest@4.0.17`，触发条件涉及启动 Vitest UI 服务，公告修复阈值为 `>=4.1.0`；其他 Vitest 公告要求更高补丁版本，实际升级应覆盖当前全部公告。Vite `7.2.7`、tsup 引入的 Rollup `4.53.3` 及 lint/构建工具依赖仍有高危项。此计数是审计公告结果，不能直接解释为生产站点存在 81 条可利用攻击路径；依赖升级与可达性核对作为独立后续任务，本轮未批量改依赖。

## 5. 已知范围与优先审查项

具体触发条件、代码入口和出口条件见 [Review 问题清单](./review-findings.zh-CN.md)。

| 范围 | 当前判断/核对重点 | 对后续规划的影响 |
| --- | --- | --- |
| 单文档最小闭环 | 最终门禁与 6 条 Chromium E2E 已通过，包含末轮两项修复；全量人工 review 按操作表记录 | 人工发现的数据丢失、错误历史、卡住交互优先修复，再加功能 |
| 旧架构目录 | 2026-10-30 检查 `apps/src` 仍有 133 个文件，不在 workspace Cafe 入口中 | 先列引用并隔离/归档，避免后续修改命中旧实现 |
| `milk` | 检查时 `packages/milk/src/index.ts` 为空；Cafe UI 不自动算成 UI SDK | 有真实复用需求再迁移，不以空包衡量产品能力 |
| 主线程只读边界 | runtime 已接通 guard；raw SAB/TypedArray 与 authority API 仍是内部可信对象 | 公开 API 前须建立受限 facade，不宣称内存强隔离 |
| 删除与历史 | 显式删除/历史重放的生命周期通知仍有路径缺口，Cafe 尚无删除 UI | 增加删除/图层树前先验收完整跨线程 undo/redo |
| 文件支持范围 | 矩形基础属性回环需实测；逐类核对其他节点/资源/字段 | 稳定文件契约之前谨慎扩展导入和自动化 |
| 扩展平台 | commands/keybindings/menus/DI 原型存在；贡献点、插件宿主和权限待产品消费者验证 | 优先让已有编辑行为消费，避免同时扩张多套平台层 |
| 性能/内存 | 尚无生产规模基线；离屏透明层与导入双 runtime 的峰值待测 | 先定目标节点数/帧预算/内存，再讨论 Rust/WASM |
| 发布与依赖 | 本地验证、CI、npm 外部消费、安全审计分别验收 | 含高危依赖或消费失败时，不应把 demo 可用当成发布就绪 |

## 6. Review 完成后需要做的规划决定

| 决定 | 建议初始方向 | 需要留下的明确结论 |
| --- | --- | --- |
| 下一阶段主目标 | 先加固已有闭环与投影/历史一致性 | 选择 1 条主线；P0 遗留问题和 P1 入口分别列出 |
| 产品定位 | 可嵌入单文档编辑器内核，以 Cafe 做集成验收 | 首个消费者、最小可用功能和暂缓能力 |
| 图形语义 | 先统一位置、尺寸、选择、层级和样式 | local/world、Frame/Group、锁定/隐藏、单选/多选输入约定 |
| 文件兼容 | 定义已支持节点/字段的回环矩阵 | 版本、迁移、替换/合并、历史与资源保存策略 |
| UI 归属 | 稳定的可复用面板迁入 `milk` | Cafe 特有 UI 与公共组件的边界 |
| 工程底线 | 全包 build、关键 E2E、漏洞分级与发布消费检查 | 哪些检查阻断合并/发布，谁负责例外 |
| 性能目标 | 从 1k/10k 等固定场景开始测量 | 节点数、交互 p95 帧耗时、启动时间、内存上限 |
| 扩展/Rust/协作 | 暂作后续候选，由消费者和基线触发 | 启动条件，而非提前承诺日历日期 |

建议阶段划分：先完成本轮验收与 review 缺陷修复；再做 P1 数据一致性/历史与文件契约；然后选一条产品能力主线（例如图层管理与多选，或 Frame/layout）。插件、协作、Dev Mode 和 Rust/WASM 继续在长期路线图中单独决策。

## 7. Review 记录模板

复制下面模板，每个问题单独一条。将“已验证缺陷”“待验证风险”“产品决策”“后续增强”分开，避免把所有意见都当成阻断项。

```text
Review 基线：commit / branch / 日期
范围：产品 / UI / Runtime / RPC / Worker / History / SAB / Projection / Render / IO / CI / 发布
类型：已验证缺陷 / 待验证风险 / 产品决策 / 后续增强
优先级：P0 数据损坏或闭环不可用 / P1 常见操作错误 / P2 质量或扩展改进
现象与复现：
预期行为：
代码位置与证据：
影响范围：
拟采取的修复或决定：
验收用例：
状态：未处理 / 处理中 / 已验证 / 延后（理由）
```

Review 出口清单：

- [ ] 关键产品操作已在固定 commit 上实际通过，未验项已标明。
- [ ] 每条 document 写入都能追溯到 Worker policy、dirty 与历史。
- [ ] 文件支持范围有实测回环矩阵，失败导入不会破坏当前编辑内容。
- [ ] 工程门禁结果可复现，coverage 与 audit 的范围和限制已记录。
- [ ] 未解决问题进入带验收条件的任务清单，产品语义决定已有结论。
- [ ] 从清单选出下一阶段主目标及暂缓范围，再安排开发。
