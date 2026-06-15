# Figma Layout Resize Plan

> 日期：2026-06-08
>
> 目标：在当前 `SharedArrayBuffer + SoA + Worker 权威写入 + 主线程只读投影`
> 架构上，补齐 Figma 风格的 Frame resize、constraints、auto layout 和 group
> 自动包裹语义。

本文档用于后续实施前的架构依据。它承接当前已经完成的
`world transform step -> inverse parent local` 自由变换方案，但明确指出：
自由变换和布局 resize 是两条不同语义，不能长期混在同一个 transform 分支里。

## 1. 背景与当前状态

当前代码已经把移动、旋转、自由缩放收敛到 worker 侧：

```text
main thread intent
  -> TransformInteractionController
  -> TransformService RPC
  -> MutationGate / TransactionManager
  -> TransformSystem
  -> NodeCursor writes SAB
  -> MatrixSystem / AABBSystem
  -> renderer readonly projection
```

当前 `TransformSystem` 处理的是自由变换：

- `moveTo` 使用 world target position。
- `moveBy` 在 session 内使用从起始快照出发的 total world delta。
- `transformAround` 使用 world-space pivoted matrix。
- `resize` 当前按 selected node basis 构造 `worldStep`，再递归反解 descendants 的 local transform。

这条路径适合 Figma 的自由变换、选区缩放、临时组缩放、Scale Tool 一类操作。

但它还不能完整覆盖 Figma 的布局语义：

- Frame resize 时 child constraints 如何响应。
- Auto layout container 如何重新排布和决定 hug/fill/fixed 尺寸。
- Group/boolean 这类 auto-bounds parent 如何派生自身 bounds。
- 属性面板 X/Y/W/H 和自由变换之间如何分流。
- 导入/导出 Figma 兼容字段时如何保存和回放 layout 信息。

## 2. Figma 语义参考

后续实现应以官方语义为主，当前建议长期跟随这些概念：

- Constraints：定义 layer 在 parent frame resize 时如何响应。
  官方文档：<https://help.figma.com/hc/en-us/articles/360039957734-Apply-constraints-to-define-how-layers-resize>
- Auto layout：定义 frame 内 children 的自动排列、padding、gap、hug/fill/fixed。
  官方文档：<https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties>
- Position panel：Figma 属性面板的 X/Y/W/H/Rotation 是设计面板里的 layer 几何编辑入口。
  官方文档：<https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-and-position>
- `relativeTransform`：Figma Plugin API 中明确用于相对 parent 的 transform，且 scaling
  不由 `relativeTransform` 表达，而由 `width/height` 与 resize 类 API 处理。
  官方文档：<https://developers.figma.com/docs/plugins/api/properties/nodes-relativetransform/>
- Plugin resize API：Figma Plugin API 把尺寸修改建模为 resize 类能力。
  官方文档：<https://developers.figma.com/docs/plugins/api/properties/nodes-resize/>

我们不需要逐字复制 Figma 内部实现，但用户可见行为应尽量贴近。

## 3. 核心设计原则

### 3.1 Worker 仍是唯一写入权威

所有 layout、constraints、auto-bounds 计算最终都必须在 worker 内完成：

```text
UI / panel / tool / plugin
  -> main-thread service facade
  -> RPC
  -> worker service
  -> MutationGate
  -> systems / pure layout algorithms
  -> NodeCursor writes
```

主线程可以读 projection，用于 hit test、selection handle、property panel 展示。
主线程不直接写 SAB，不直接绕过 worker 修改 `matrix/size/layout` 列。

### 3.2 发送 target，不发送逐帧增量

高频交互、右侧面板、插件 API 都应发送明确 target：

- Move：target world position，或 session total world delta。
- Rotate：target rotation matrix/angle from session snapshot。
- Free resize：target width/height 或 target selection box。
- Panel edit：target panel-local X/Y/W/H/rotation。
- Layout edit：target layout property。

worker 内以 transaction snapshot 为 base 计算结果，避免逐帧增量叠加带来的浮点误差和事件丢帧偏差。

### 3.3 Transform 和 Layout 分层

不要让 `TransformSystem` 承担全部 Figma 行为。

建议分层：

| 层                    | 职责                                   | 示例                                                     |
| --------------------- | -------------------------------------- | -------------------------------------------------------- |
| `TransformSystem`     | 自由变换数学                           | move、rotate、scale selection、world step、inverse local |
| `ConstraintsSystem`   | parent resize 时 child constraint 响应 | left/right/center/stretch/scale                          |
| `AutoLayoutSystem`    | auto layout container 排布             | horizontal/vertical、padding、gap、hug/fill              |
| `GroupBoundsSystem`   | group/boolean 派生 bounds              | children union -> group bounds                           |
| `LayoutService`       | worker RPC domain facade               | setConstraints、resizeFrame、setAutoLayout               |
| pure layout functions | 可测试算法内核                         | resolveConstraints、measureAutoLayout、placeAutoLayout   |

`TransformSystem.resize` 可以继续代表自由缩放。
Frame 右侧面板 resize 和工具 resize frame 应进入 `LayoutService.resizeFrame`
或 `FrameService.resize`，再由 layout/constraints 系统决定 children 如何变化。

### 3.4 视觉结果优先用 world corner 校验

几何行为不能只看 `x/y/width/height`。

后续所有复杂 resize 测试都应验证：

```text
actual rendered corners == expected world-step or expected layout result corners
```

这能防止局部矩阵看似正确，但 renderer 视觉和 Figma 不一致。

## 4. 坐标模型

### 4.1 三种坐标需要明确区分

| 坐标                         | 含义                                                                          | 使用场景                                    |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| Local parent coordinate      | node 相对直接 parent 的局部坐标                                               | SAB `matrix`、worker 写入                   |
| Containing parent coordinate | Figma 属性面板更接近的 parent 坐标，可能跳过 group/boolean auto-bounds parent | 右侧面板 X/Y                                |
| World/page coordinate        | page/canvas 下的绝对坐标                                                      | renderer、hit test、selection OBB、自由变换 |

当前 `espresso` 的 `matrix` 是直接 parent local transform，`worldMatrix`
是 `parentWorld * local` 的缓存。这个模型可以保留。

### 4.2 右侧属性面板的建议语义

右侧面板不应直接调用自由变换 `moveBy`。
建议面板分流：

```text
Panel X/Y edit
  -> TransformService.setPanelPosition(id, panelPosition)
  -> worker resolve containing parent
  -> convert panel local target to direct-parent local target

Panel W/H edit
  -> LayoutService.resizeNode(id, targetSize, { source: "panel" })
  -> if node is frame and layout/constraints enabled: layout resize
  -> if node is group or selected temporary group: free transform or derived bounds rule
  -> if node is shape/text: size update plus transform compensation when needed

Panel rotation edit
  -> TransformService.setPanelRotation(id, targetAngle)
  -> worker uses snapshot and containing/world basis as required
```

对于顶层 node，panel coordinate 看起来会接近 world/page coordinate。
对于 Frame/Component 内部子节点，panel coordinate 更接近 containing parent local coordinate。
对于 Group/Boolean，Figma 有特殊 containing parent 规则；Latte 后续也应显式建模，
而不是隐式依赖 scene tree 的直接 parent。

## 5. 数据模型规划

当前 `bean` schema 已经有 `FRAME` 和 `GROUP`，但没有 constraints/autolayout 字段。
建议分阶段扩展。

### 5.1 Constraints schema

建议先对齐 Figma Plugin API 的枚举风格：

```ts
export type ConstraintHorizontal =
  | 'MIN'
  | 'CENTER'
  | 'MAX'
  | 'STRETCH'
  | 'SCALE'

export type ConstraintVertical = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'

export interface IConstraints {
  horizontal: ConstraintHorizontal
  vertical: ConstraintVertical
}
```

存储位置：

- `bean`: 文件 schema 和 RPC 类型。
- `espresso`: SoA enum columns，例如 `constraintHorizontal: Uint8Array`,
  `constraintVertical: Uint8Array`。
- `barista`: `ConstraintOps`、`NodeCursor.constraints`。

默认值建议：

```text
horizontal = MIN
vertical = MIN
```

### 5.2 Auto layout schema

建议分 container properties 和 child properties。

Container:

```ts
export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL'
export type AxisSizingMode = 'FIXED' | 'AUTO'
export type PrimaryAxisAlign = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
export type CounterAxisAlign = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'

export interface IAutoLayoutContainer {
  layoutMode: LayoutMode
  primaryAxisSizingMode: AxisSizingMode
  counterAxisSizingMode: AxisSizingMode
  primaryAxisAlignItems: PrimaryAxisAlign
  counterAxisAlignItems: CounterAxisAlign
  itemSpacing: number
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  paddingBottom: number
}
```

Child:

```ts
export type LayoutAlign = 'INHERIT' | 'STRETCH'
export type LayoutPositioning = 'AUTO' | 'ABSOLUTE'

export interface IAutoLayoutChild {
  layoutAlign: LayoutAlign
  layoutGrow: 0 | 1
  layoutPositioning: LayoutPositioning
}
```

第一阶段可以不做完整 Figma 变量、wrap、baseline、min/max、文本测量特殊规则。
但字段设计要给未来扩展留空间。

### 5.3 Group bounds schema

Group 不应长期被当成普通 fixed-size container。
建议建模：

```ts
export type BoundsMode = 'FIXED' | 'AUTO'
```

- Shape/Frame 默认 `FIXED`。
- Group 默认 `AUTO`。
- Boolean/vector group 未来也倾向 `AUTO`。

Group 的 `size` 和 `transform` 是 derived result，主要由 children bounds 推导。
直接 resize group 时走自由变换，而不是 layout resize。

## 6. 计算语义规划

### 6.1 Free transform

已实现方向：

```text
worldStep = selectedWorld * stepInSelectedBasis * inverse(selectedWorld)
targetWorld = worldStep * oldWorld
targetLocal = inverse(parentTargetWorld) * targetWorld
```

用途：

- 选区缩放。
- 临时组缩放。
- Scale Tool。
- Group 作为 selection 被自由缩放。
- 多选对象统一旋转/缩放。

它不负责：

- Frame constraints。
- Auto layout。
- Group auto-bounds 派生。

### 6.2 Frame resize with constraints

Frame resize 是 layout 语义，不是 free transform。

输入：

```text
frameId
targetFrameSize
baseFrameSize
children base local rects
children constraints
```

对每个 child，按 parent local coordinate 计算新 rect。
水平和垂直轴分别处理。

Horizontal:

| Constraint | 行为                                        |
| ---------- | ------------------------------------------- |
| `MIN`      | 保持 left offset，size 不变                 |
| `MAX`      | 保持 right offset，size 不变                |
| `CENTER`   | 保持相对 center 的 offset，size 不变        |
| `STRETCH`  | 保持 left/right offset，size 随 parent 变化 |
| `SCALE`    | left 和 size 按 parent ratio 缩放           |

Vertical 同理：

| Constraint | 行为                                        |
| ---------- | ------------------------------------------- |
| `MIN`      | 保持 top offset，size 不变                  |
| `MAX`      | 保持 bottom offset，size 不变               |
| `CENTER`   | 保持相对 center 的 offset，size 不变        |
| `STRETCH`  | 保持 top/bottom offset，size 随 parent 变化 |
| `SCALE`    | top 和 size 按 parent ratio 缩放            |

对于 rotated child：

- constraints 先作用在 child 的 layout rect。
- 再把 layout rect 映射到 local transform 和 size。
- 渲染角点必须与预期 layout rect 对齐。

对于 rotated frame：

- constraints 仍在 frame local coordinate 内计算。
- frame 的 world rotation 由 matrix pipeline 处理。

### 6.3 Auto layout resize

Auto layout container 的 resize 分两步：

```text
1. resolve container size
2. place children
```

Container size:

- `FIXED`: 使用 explicit width/height。
- `AUTO` or hug: 根据 children intrinsic/measured size + padding + gap 回推。
- Frame 被 panel resize 时，panel target 可临时把 axis sizing 改成 fixed，具体规则后续再精细对齐。

Children:

- `layoutPositioning = AUTO`: 参与 auto layout flow。
- `layoutPositioning = ABSOLUTE`: 不参与 flow，后续可继续走 constraints 或 absolute position 规则。
- `layoutGrow = 1`: 在 primary axis 分配剩余空间。
- `layoutAlign = STRETCH`: 在 counter axis 拉伸到可用尺寸。

Auto layout 会写入 children 的 local transform 和 size。
因此它必须在 worker 内成为 mutation path 的一部分，并纳入 history。

### 6.4 Group auto-bounds

Group 的 bounds 是 children 派生结果。

当 group 内 child 移动、resize、显示隐藏、删除、插入时，应重新计算 group bounds。
建议规则：

```text
groupLocalBounds = union(children visual bounds in group local coordinate)
group.transform = oldGroupWorld * T(groupLocalBounds.min)
group.size = groupLocalBounds.size
child.local = inverse(newGroupWorld) * oldChildWorld
```

这样 group 自身 bounds 收缩/扩张时，children 的 world 视觉位置不漂移。

多层 group 需要自底向上处理：

```text
changed leaf
  -> recompute nearest auto-bounds group
  -> preserve descendants world
  -> mark parent group dirty
  -> repeat upward
```

Group auto-bounds 会和 Matrix/AABB 有双向依赖，不能简单塞进当前 AABBSystem。
建议做独立 `GroupBoundsSystem` 或 `BoundsDerivationSystem`，并使用明确的 pipeline 阶段。

## 7. Worker pipeline 建议

当前 pipeline：

```text
MatrixSystem -> AABBSystem
```

后续建议演进为：

```text
Mutation RPC
  -> semantic service chooses operation
  -> direct writes or layout intent records
  -> LayoutInvalidationTracker
  -> ConstraintsSystem
  -> AutoLayoutSystem
  -> GroupBoundsSystem
  -> MatrixSystem
  -> AABBSystem
  -> optional GroupBoundsSystem second pass if needed
  -> render dirty notification
```

第一阶段不要追求一次性全自动 pipeline。
更稳妥的实现是由 worker service 显式调用 pure algorithms：

```text
LayoutService.resizeFrame
  -> capture affected subtree
  -> resolve constraints
  -> resolve auto layout if enabled
  -> write NodeCursor fields
  -> mark dirty
```

等规则稳定后，再把共同逻辑抽成 systems pipeline。

## 8. Service/API 规划

### 8.1 Worker services

新增或扩展：

```ts
interface ILayoutService {
  resizeFrame(id: IDType, size: vec2): Promise<void>
  setConstraints(id: IDType, constraints: IConstraints): Promise<void>
  setAutoLayout(
    id: IDType,
    layout: Partial<IAutoLayoutContainer>
  ): Promise<void>
  setLayoutChild(id: IDType, props: Partial<IAutoLayoutChild>): Promise<void>
}
```

保留：

```ts
interface ITransformService {
  moveTo(ids, worldPosition)
  moveBy(ids, totalWorldDelta)
  transformAround(ids, matrix, worldPivot)
}
```

不建议把 `resizeFrame` 放进 `TransformService`。
Frame resize 是 layout mutation，不是纯 transform mutation。

### 8.2 Main-thread facade

`crema` 或未来 public API 可以暴露更语义化的 facade：

```ts
runtime.layout.resizeFrame(id, size)
runtime.layout.setConstraints(id, constraints)
runtime.nodes.setPanelPosition(id, position)
runtime.transform.scaleSelection(ids, box)
```

插件作者不应直接操作 transaction。
transaction 仍由 `MutationGate` 自动包裹。

### 8.3 属性面板调用路径

右侧面板建议路径：

```text
Panel numeric input
  -> command or direct service call
  -> local facade validates target
  -> RPC target mutation
  -> worker computes semantic result
  -> history push once
```

例如：

```text
User changes Frame width from 100 to 150
  -> LayoutService.resizeFrame(frameId, [150, oldHeight])
  -> ConstraintsSystem adjusts children
  -> AutoLayoutSystem if layoutMode != NONE
  -> GroupBoundsSystem updates ancestors if needed
```

## 9. Implementation Roadmap

### P0: Semantic boundary and docs

目标：

- 保留当前 free transform。
- 明确 `TransformSystem.resize` 是 selection/free transform，不是 frame layout resize。
- 增加文档和测试，防止 target 语义退化为增量叠加。

验收：

- move/rotate/resize session 均以 snapshot 为 base。
- deep nested free scale 视觉角点测试通过。

当前本轮已覆盖大部分 P0。

### P1: Constraints data model and ops

目标：

- 在 `bean` 增加 constraints 类型。
- 在 `espresso` 增加 SoA enum columns 和 `ConstraintOps`。
- `NodeCursor` 暴露 constraints getter/setter。
- loader/serializer 支持 constraints。

测试：

- default constraints。
- serializer roundtrip。
- external blank buffer 初始化。
- mutation records 和 undo/redo。

### P2: Frame resize with constraints

目标：

- 新增 `LayoutService.resizeFrame`。
- 新增 pure `resolveConstraintsResize`。
- 支持 non-auto-layout frame 的 child constraints。
- 支持 rotated frame 下的 local layout 计算。

测试矩阵：

- horizontal: `MIN/CENTER/MAX/STRETCH/SCALE`。
- vertical: `MIN/CENTER/MAX/STRETCH/SCALE`。
- nested frame。
- rotated parent frame。
- undo/redo。
- panel target width/height 不累计误差。
- rendered corners 对齐 expected local-layout result。

### P3: Group auto-bounds

目标：

- Group size/transform 由 children visual bounds 派生。
- child move/resize/delete 后 group bounds 自动更新。
- group bounds 更新不改变 children world visual position。
- 多层 group 自底向上更新。

测试：

- child move causes group bounds change。
- child resize causes group bounds change。
- rotated child inside group。
- nested group。
- undo/redo preserves group derived bounds。

### P4: Basic auto layout

目标：

- 支持 `layoutMode = HORIZONTAL | VERTICAL`。
- 支持 padding、itemSpacing。
- 支持 fixed/hug 基础模型。
- 支持 child `layoutGrow` 和 `layoutAlign = STRETCH`。
- absolute child 暂时不参与 flow。

测试：

- horizontal fixed container。
- vertical fixed container。
- hug width/height。
- fill remaining primary axis。
- stretch counter axis。
- nested auto layout。
- text placeholder measurement。

### P5: Panel and plugin integration

目标：

- 右侧面板使用 semantic services。
- 插件 API 暴露 stable facade，不泄漏内部 service。
- panel coordinate resolver 支持 containing parent 规则。

测试：

- selected child in frame: panel X/Y edits parent-local position。
- selected top-level child: panel X/Y edits page/world-like position。
- selected node inside group: containing parent resolver 符合规划。
- plugin call 和 UI call 走同一 worker mutation path。

### P6: Figma compatibility fixtures

目标：

- 建立一组 Figma-like fixture。
- 对 constraints、auto layout、group bounds 做 golden tests。
- 引入可视化 smoke 或 screenshot diff。

测试：

- Import fixture -> run layout -> compare expected positions/sizes。
- Resize frame -> compare expected children geometry。
- Render canvas nonblank and expected bounds。

## 10. Test Coverage Baseline

后续每次 touching layout/transform 都至少跑：

```bash
pnpm --filter @latte-js/barista test
pnpm --filter @latte-js/crema test
pnpm --filter @latte-js/barista type-check
pnpm --filter @latte-js/crema type-check
pnpm --filter @latte-js/bean type-check
pnpm --filter @latte-js/art type-check
pnpm --filter @latte-js/cafe build
git diff --check
```

新增 layout 阶段后，建议增加：

```bash
pnpm --filter @latte-js/espresso test
pnpm test -- --runInBand
```

如果 espresso 仍有历史不稳定 timeout，需要先把 timeout 问题单独修复，不能让 layout
回归测试建立在不稳定基础上。

## 11. Risks

### 11.1 Figma 语义细节很多

Constraints、auto layout、group bounds、component/instance、text measurement、mask/clipping
都有边界规则。建议先覆盖 80% 常用行为，不要一轮实现所有细节。

### 11.2 Group bounds 和 Matrix/AABB 会形成循环

Group auto-bounds 需要 children bounds；children bounds 依赖 matrix；group bounds 更新又会影响
children local。必须设计明确阶段和 world-preserving 写回策略。

### 11.3 Text measurement 需要 renderer/font service 配合

Auto layout 的 hug content 对 text 强依赖测量。短期可以使用 Canvas text metrics 或占位测量，
长期需要统一 TextLayoutService。

### 11.4 Undo/redo 需要捕获派生变更

Frame resize 可能同时修改 frame、children、ancestor groups。
Transaction 必须 capture affected subtree，而不是只 capture 显式选中节点。

### 11.5 Main-thread projection 可能短暂滞后

主线程只读 projection 是正确方向，但属性面板如果基于 stale projection 展示，需要通过 dirty
notification 或 request-after-commit 保证关键数据刷新。

## 12. Near-term Next Actions

建议下一轮按这个顺序推进：

1. 在 `bean` 定义 constraints 和 auto layout types，但先只启用 constraints。
2. 在 `espresso` 增加 constraints SoA columns、ops、NodeCursor getter/setter。
3. 在 `barista` 增加 pure `resolveConstraintResize`，先不接 RPC。
4. 为 5 x 5 constraints case 建单元测试。
5. 新增 `LayoutService.resizeFrame`，走 MutationGate/History。
6. 接入 Frame 属性面板 resize target。
7. 再做 Group auto-bounds。
8. 最后做 AutoLayoutSystem。

这条路线能保持当前 free transform 稳定，同时逐步把 Figma 布局语义接入 worker 权威写入架构。
