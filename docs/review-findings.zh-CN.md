# Latte 本轮 Review 发现与后续问题清单

> 日期：2026-10-30；范围：`codex/development` 的单文档编辑闭环与全仓审查。
>
> 配合 [全量 Review 路线图](./review-roadmap.zh-CN.md) 使用。本轮比较基线固定为 `a69c5ccfbf22d304399b0d6854707afcfbfc89aa`，实现审查终点为 `26905d1883e96d1f02ba1cb4d9843c4072868c90`。阶段提交映射见路线图；文档、CI 与 release-gate 另作配套提交。本轮开发分支先供用户全量 review，review 后再决定是否经 PR 合并 main。

2026-10-30 最终 `pnpm release:check` 已通过：**59 个 Vitest 文件 / 446 个测试、workspace build 10/10、Chromium E2E 6/6**；license、lint、type-check 与 diff 检查通过。运行对象为上述实现终点及配套 CI/release-gate 改动，包含下述末轮 resize/blur 修复。E2E 覆盖真实 Worker 的创建、编辑、历史、文件回环、非法输入、透明度像素及属性草稿直接触发工具栏动作；未覆盖的人工场景、生产部署和外部包消费仍需单独验收。

`pnpm test:coverage` 同样通过（59 文件/446 测试）：语句 **73.79%**、分支 **61.94%**、函数 **73.23%**、行 **74.14%**。当前配置未显式纳入全部源码，未被测试导入的文件可能不在分母中；完整计数见 [路线图验证记录](./review-roadmap.zh-CN.md)。这组数字不能解释为全仓正确率。

优先级按影响和进入产品的时机安排：P0 为数据损坏或当前闭环不可用；P1 为已有服务正确性、上线/发布条件及下一阶段必须先解决的问题；P2 为工程整理、性能测量和后续增强。代码路径确认、浏览器已复现、待验证风险应分别记录。

## 本轮已落实修复，供定向复查

下表列出的实现及对应回归用例已纳入最终通过的本地门禁；验收出口列供人工全量 review 定向复核，也明确下一次修改需要保持的行为。

| 发现与触发 | 当前处理 | 重点代码/回归入口 | 验收出口 |
| --- | --- | --- | --- |
| 拖动尚未 begin 完成就 release/cancel，或画布外释放，可能留下事务/捕获状态 | 收拢 begin/move/commit/cancel 生命周期，补原生 pointer capture、取消和 dispose 收尾 | [交互控制器测试](../packages/crema/src/interactions/__test__/transformInteractionController.test.ts)、[输入测试](../packages/syrup/src/services/__test__/inputService.test.ts)、[选择工具测试](../packages/counter/src/contrib/select/__test__/selectionTool.test.ts) | 快速连续拖动、画布外 release/cancel 后能继续编辑；一次拖动一条历史；取消恢复原值 |
| 创建与挂载原本分两次调用，撤销可能残留孤立节点 | `createNode.parentId` 在同一次 Atomic policy 中创建并挂载 | [NodeSystem](../packages/barista/src/systems/node.ts)、[矩形工具](../packages/counter/src/contrib/rectangle/rectangleTool.ts)、[事务集成测试](../packages/barista/src/services/__test__/transformServiceTransactions.test.ts) | 一次 undo 移除完整创建；redo 恢复正确父级和位置；无效父级不产生节点/历史 |
| UI 属性面板需要可审计的写入入口；部分目标无效时可能半批写入 | 新增 Style RPC/Service，先校验 patch 和所有目标，再写名称、solid fills、opacity、visible、locked | [StyleService](../packages/barista/src/services/style.ts)、[StyleService 测试](../packages/barista/src/services/__test__/styleService.test.ts)、[属性适配器](../packages/crema/src/editing/editorSessionController.ts) | 所有修改经 Worker；失败不改变任一目标/历史；面板颜色输入明确会替换为单一纯色填充 |
| `Number.isFinite(1e40)` 为真，Float32 写入却可能变 Infinity，保存可能出现 null | UI、节点创建和 TransformSystem 校验 Float32 可表示范围 | [属性适配器](../packages/crema/src/editing/editorSessionController.ts)、[NodeSystem](../packages/barista/src/systems/node.ts)、[TransformSystem](../packages/barista/src/systems/transform.ts)、[超范围值回归测试](../packages/barista/src/services/__test__/transformServiceTransactions.test.ts) | 超范围输入失败且画布、保存值、历史不变；正常负坐标和合法尺寸仍可用 |
| 主线程“只读 projection”此前未在 runtime 实际启用 guard | runtime 调用 `protectGraph`，NodeCursor/结构写入受 guard 限制，ID-map 更新使用受控 `WriteNoHistory` scope | [EditorRuntime](../packages/crema/src/editorRuntime.ts)、[ProjectionSync 测试](../packages/crema/src/projection/__test__/projectionSyncController.test.ts) | 活动/非活动 graph 的普通写入被拒绝；Worker 共享内存写入和 ID-map 同步仍正常 |
| 仅监听绘制 dirty 无法完整刷新名称、创建/删除、文件加载后的面板/选区 | 新增 projection `onDidChange`，在 ID-map/version 更新后通知 session UI | [ProjectionSyncController](../packages/crema/src/projection/projectionSyncController.ts)、[属性适配器](../packages/crema/src/editing/editorSessionController.ts)、[ProjectionSync 测试](../packages/crema/src/projection/__test__/projectionSyncController.test.ts) | 生命周期变化后选区不会保留失效 ID；非绘制 metadata 及时刷新，绘制调度语义不混淆 |
| 真实 IPC 事件工厂延迟订阅，离开 session context 后注册到 default session，导致选中有 ID 但面板为空 | `BaristaEngine.listen` 将实际 listener 注册也包入目标 session context | [BaristaEngine](../packages/barista/src/worker/baristaEngine.ts)、[引擎/通道集成测试](../packages/barista/src/worker/__test__/baristaEngine.test.ts) | 创建通知能更新目标 projection ID-map 并读回；A/B/default 隔离；unlisten 后不再通知 |
| 节点 opacity 已写入模型，绘制未应用；直接设 globalAlpha 又会被 paint 覆盖 | encoder 保留祖先透明层边界，Canvas2D 使用池化离屏 surface 先合成内容，再应用 layer opacity | [命令编码](../packages/art/src/core/renderCommandEncoder.ts)、[Canvas2D](../packages/art/src/render/canvas/canvas2DBackend.ts)、[编码测试](../packages/art/src/core/__test__/renderCommandEncoder.test.ts)、[合成测试](../packages/art/src/render/canvas/__test__/canvas2DOpacity.test.ts) | 矩形/椭圆、组内重叠、嵌套组、paint alpha 与节点 alpha 均正确；[E2E](../e2e/editor-loop.spec.ts) 检查真实像素及 undo |
| 保存/加载遗漏椭圆 fills、Canvas 背景和矩形四角；legacy blend 字符串与绘制枚举不一致 | loader/snapshot 映射补齐，blend 规范化；UI 显式校验支持范围 | [Loader](../packages/espresso/src/io/latteLoader.ts)、[nodeSnapshot](../packages/espresso/src/data/nodeSnapshot.ts)、[字段回环测试](../packages/espresso/src/io/__test__/serializerRoundtrip.test.ts)、[导入校验测试](../packages/crema/src/document/__test__/validateDocument.test.ts) | 支持字段 save→load→save 语义相同；不支持节点/资源明确报错，失败保留原文档 |
| UI 将原地 upsert 当替换会混入旧节点；候选 runtime 失败/取消需清理 | Cafe 在隐藏 staging 画布启动独立 runtime/Worker，成功后切换；失败保留旧 runtime；取消时立即 dispose 未启用候选 | [Cafe App](../apps/cafe/src/app.tsx)、[编辑/导入 E2E](../e2e/editor-loop.spec.ts) | 重复导入无重复节点，后加节点不混入旧文件；成功状态只在切换完成后显示；失败可继续编辑 |
| 导入替换文档/释放 runtime 时，emitter 清理进入 `LinkedList.clear`，将对象哨兵当作 truthy 节点而循环卡死；clear 后旧 disposer 还可能破坏新链表 | 从首节点遍历，并以 `Node.Undefined` 显式终止；节点记录 attached 状态，忽略已脱离节点的 stale disposer；保留自退订时的迭代连续性 | [LinkedList](../packages/kit/src/linkedList/linkedList.ts)、[清理/退订测试](../packages/kit/src/linkedList/__test__/linkedList.test.ts)、[Emitter](../packages/kit/src/event/event.ts)、[导入 E2E](../e2e/editor-loop.spec.ts) | 空/单/多节点可重复 clear 后复用；旧 disposer 不删除新节点或错误减 size；当前 listener 自退订不跳过后续 listener；文档切换可完成 |
| 门禁只构建 Cafe，开发分支 push 未触发同等 CI | release gate 改为 workspace build；CI 加入 `codex/development` push | [release gate](../scripts/release-gate.mjs)、[CI](../.github/workflows/ci.yml) | 本地全包 build 和最终门禁通过；云端 CI 在实际 push 后核对；生产部署仍按 main 条件 |

### 末轮新增修复，已纳入最终通过的门禁

| 发现与触发 | 修复目标/当前状态 | 重点代码/回归入口 | 验收出口 |
| --- | --- | --- | --- |
| resize session 中父级宽 100→200→150，`_collectDescendantIds` 漏掉部分兄弟子树，未捕获的后代使用中间尺寸再次缩放 | 已从根出发完整遍历子链/兄弟子树，使每次 resize$ 更新均读取初始快照；新增多兄弟及嵌套后代/取消回归 | [TransformSystem](../packages/barista/src/systems/transform.ts)、[TransformSystem 测试](../packages/barista/src/systems/__test__/transformSystem.test.ts) 中 `uses initial snapshots for every sibling subtree during repeated resize and cancel` | 所有后代均按初始值乘最终 1.5 倍；连续更新无累积；commit 一条历史，cancel/undo/redo 恢复全部兄弟 |
| 属性草稿未提交时直接点击 Save，blur 先触发异步更新并禁用工具栏，使随后的 click 被丢弃 | 已改为工具栏在 loading 时禁用；working 期间可用的 Save/Undo/Redo/工具切换经 run 队列排在 blur 提交后，画布和属性仍受完整 busy 保护；E2E 与最终门禁通过 | [PropertyPanel](../apps/cafe/src/propertyPanel.tsx)、[Cafe App](../apps/cafe/src/app.tsx)、[编辑 E2E](../e2e/editor-loop.spec.ts) 中 `toolbar actions preserve a property draft committed by blur` | 不先按 Enter，直接点一次 Save 即下载，JSON 含最新草稿；可用的 Undo/Redo/工具切换不要求第二次点击；失败输入不造成错保存或界面卡死 |

## 尚待处理或验证的 P1

| 编号/优先级 | 问题、证据与触发条件 | 代码入口 | 下一步与验收出口 |
| --- | --- | --- | --- |
| R1 · P1，删除入口前 | **删除→撤销的 projection ID-map 恢复缺口。** 显式 delete 发通知移除主线程 ID-map；历史重放直接激活 tombstone，不发 NodeSystem 创建通知，dirty payload 也无 id→index 修复信息。代码路径已确认，跨线程表现需独立集成复现；当前 Cafe 未提供删除按钮 | [NodeSystem](../packages/barista/src/systems/node.ts)、[MutationRecordApplier](../packages/barista/src/history/mutationRecordApplier.ts)、[NotificationPlanner](../packages/barista/src/pipeline/notificationPlanner.ts)、[ProjectionSync](../packages/crema/src/projection/projectionSyncController.ts) | 统一 lifecycle replay 或明确投影恢复协议；真实 Worker 验收父子树 delete→undo→redo，核对 ID-map、绘制、命中、选区和保存 |
| R2 · P1，发布前 | **生产跨源隔离未验收。** Vite dev 设置 COOP/COEP；静态部署产物不会自带响应头，CDN/iframe 的策略也可能使 SAB 不可用 | [Vite 配置](../apps/cafe/vite.config.js)、[部署 CI](../.github/workflows/ci.yml)、[BaristaClient](../packages/barista/src/client/baristaClient.ts) | 在真实托管地址记录响应头、`crossOriginIsolated`、SAB/Worker 启动与完整编辑 E2E；若环境不支持，明确支持矩阵及产品报错 |
| R3 · P1，对外 SDK 前 | **外部 npm pack 消费未验证。** monorepo source exports/aliases 可能掩盖 dist、types、ESM/CJS 或 Worker 资源打包问题 | [根配置](../package.json)、[crema 包](../packages/crema/package.json)、[barista 包](../packages/barista/package.json)、[BaristaClient](../packages/barista/src/client/baristaClient.ts) | `pnpm pack` 后在仓库外全新最小应用安装产物；构建并运行创建/编辑/undo/save，记录支持的 bundler 与模块格式 |
| R4 · P1，对外扩展前 | **guard 属于可信代码边界。** raw SAB/TypedArray 元素仍可写，authority 创建 API 公开；NodeCursor guard 不构成插件内存隔离 | [SceneGraph](../packages/espresso/src/data/sceneGraph.ts)、[mutationAuthority](../packages/espresso/src/data/mutationAuthority.ts)、[EditorHost](../packages/syrup/src/core/editorHost.ts) | 将 raw graph 留在内部；对消费者提供受限读取/命令 facade；列清可访问对象并测试普通扩展不能获得写权威 |
| R5 · P1，文件契约前 | **直接 load 仍是 upsert。** Cafe 通过独立 runtime 完成替换，内部 `DocumentService.load`/`LatteLoader.load` 并未改为 replace/事务回滚 | [DocumentService](../packages/barista/src/services/document.ts)、[Loader](../packages/espresso/src/io/latteLoader.ts)、[Cafe](../apps/cafe/src/app.tsx) | 定义 replace/merge/new-document 各自契约和命名，记录历史处理；各路径测试旧节点、重复 ID、失败、资源及顺序，禁止消费者误用 |
| R6 · P1，安全升级批次 | **依赖审计仍有 critical/high 项。** 本轮重新审计合计 81 项；CI audit 当前允许失败继续 | [pnpm lockfile](../pnpm-lock.yaml)、[CI audit](../.github/workflows/ci.yml)、[SECURITY](../SECURITY.md) | 按下节逐条核对依赖路径与触发条件，升级后跑全量门禁；未修项保留明确风险接受理由、负责人和复查条件 |

### 依赖审计证据

2026-10-30 `pnpm audit --json`：**81 项，1 critical、42 high、33 moderate、5 low**。原始本地结果：`.git/latte-review-audit.json`（未纳入版本管理）。这些是审计公告计数，不能直接等同于生产环境有 81 条可利用路径。

| 代表路径 | 已知触发/修复线索 | 升级验收 |
| --- | --- | --- |
| `packages__crema>vitest@4.0.17`；critical `GHSA-5xrq-8626-4rwp` | Vitest UI 服务监听时的任意文件读取/执行；该公告修复阈值 `>=4.1.0`，其他当前公告要求更高补丁版本 | 选择覆盖所有当前公告的兼容版本，配套升级 coverage；复查 lockfile/重新 audit，再跑单测、coverage 和 E2E |
| `apps__cafe>vite@7.2.7` | 开发服务器读取/Windows launch-editor 等公告；当前相关修复线索为 `>=7.3.7` | 核对 Node 最低版本、dev/build/preview 与 Worker，重新 audit |
| `.>tsup>rollup@4.53.3` | 构建工具任意文件写入公告；修复线索 `>=4.59.0` | 优先升级上游或兼容补丁，验证全包输出与外部 pack 消费 |
| lint/coverage 链中的 minimatch、flatted、source-map-js 等 | 需按实际依赖路径核对，不能把纯工具链问题直接当作生产运行时暴露 | 清除高危路径或逐条留下接受记录；升级不以 overrides 掩盖版本不兼容 |

工具链/开发服务占主要代表路径；仍需完成全量可达性分类后，才决定哪些审计项阻断 PR、哪些阻断公开部署或包发布。当前 audit warning 策略应作为明确工程决策复审。

## P2 工程债与产品边界

| 项目 | 当前事实/影响 | 出口条件 |
| --- | --- | --- |
| 旧实现目录 | `apps/src` 仍有 133 个文件，未包含在当前 workspace 的 `apps/cafe` 入口中；容易误读或修错文件 | 列全引用、文档和脚本依赖，确认后归档/删除；build/test 不回退 |
| UI SDK | `packages/milk/src/index.ts` 为空；当前属性面板实现在 Cafe | 明确首个复用消费者、组件输入/事件边界，再迁移公共 UI，避免以空包声明已完成 SDK |
| 覆盖率口径 | 根级 Vitest 覆盖率没有显式全源码 include，未被测试导入的源码可能不在分母中 | 先列缺测的高风险文件，定义排除项与覆盖范围；只对实际纳入范围解释百分比 |
| 性能与内存 | 尚无固定规模基线；透明度 surface 按完整 viewport 池化，高 DPR/深层透明组有内存和合成成本；导入切换期间新旧 runtime 并存 | 固定节点数、DPR、嵌套深度和导入文件；记录启动/交互 p95/内存峰值，再决定裁剪、池容量或内核优化 |
| Node 运行版本 | 根 engines 与 Vite/Vitest、CI 实际最低版本需统一 | 选定明确的 Node LTS 最低补丁版本，锁定 CI/本地/文档；全新环境可重现门禁 |
| 文件能力边界 | 支持 DOCUMENT/CANVAS/FRAME/GROUP/RECTANGLE/ELLIPSE 与受限 Paint；TEXT/PATH/CIRCLE、IMAGE Paint、非默认 layer blend、非零 corner smoothing、非均匀各边 stroke 当前拒绝导入 | 建立节点/字段“导入、显示、编辑、保存、回环”矩阵；扩展一项就补对应完整链路 |
| 产品能力范围 | 多选基础与内核原型不等于框选/多选编辑、完整图层树、文本、布局、插件和协作已交付 | 在全量 review 后只选一条下一阶段主线，每项都带可操作验收场景 |

## Review 后如何排下一阶段

1. 固定本轮 commit，走通 [路线图产品操作表](./review-roadmap.zh-CN.md)，把实际失败记录为问题；若有数据损坏或当前闭环不可用，优先修复。
2. 优先处理 R1 与文件契约；它们直接影响删除、图层管理、多选及后续产品扩展。同步做 R6 的依赖升级批次。
3. 按交付目的选择发布前工作：线上演示处理 R2；对外 SDK 处理 R3/R4；每项保留实际环境证据。
4. 然后选择“图层管理与多选”或“Frame/layout”等一条产品主线。性能基线先行；Rust/WASM、插件与协作由明确消费者或测量结果触发。

每项任务至少留下：负责人、触发条件、固定基线、复现步骤、代码证据、验收用例和延后理由。总体成熟度以真实用户闭环、数据一致性和可部署/可消费证据判断。
