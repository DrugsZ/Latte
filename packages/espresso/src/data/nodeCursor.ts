// packages/espresso/src/data/NodeCursor.ts

import type { SceneGraph } from './sceneGraph'
import { NULL_INDEX, MAT_TX, MAT_TY, MAT_SIZE, DIRTY_TRANSFORM } from './config'

export class NodeCursor {
  private readonly _index: number
  private readonly _generation: number

  constructor(
    private _graph: SceneGraph,
    index: number
  ) {
    this._index = index
    // 记录创建时的代数，用于后续校验是否过期
    this._generation = _graph.allocator.generations[index]
  }

  /**
   * 安全检查：确保当前 Cursor 指向的节点还活着
   * 这是一个热点函数，V8 会内联它
   */
  private _checkAlive() {
    if (!this._graph.allocator.isValid(this._index, this._generation)) {
      throw new Error(`[NodeCursor] Accessing dead node: ${this._index}`)
    }
  }

  // --- 基础属性 ---

  get index() {
    return this._index
  }
  get id() {
    this._checkAlive()
    return this._graph.getUUID(this._index)
  }
  get type() {
    this._checkAlive()
    return this._graph.type[this._index]
  }

  get name() {
    this._checkAlive()
    return this._graph.nameMap.get(this._index) || 'Layer'
  }
  set name(v: string) {
    this._checkAlive()
    this._graph.nameMap.set(this._index, v)
    // 名字变了，可能需要通知 UI 刷新图层树，但不影响渲染
  }

  // --- 几何属性 (直接读写 Buffer) ---

  get x() {
    this._checkAlive()
    return this._graph.matrix[this._index * MAT_SIZE + MAT_TX]
  }
  set x(v: number) {
    this._checkAlive()
    // 1. 写内存
    this._graph.matrix[this._index * MAT_SIZE + MAT_TX] = v
    // 2. 打标记 (这是自动的，业务层不需要操心)
    this._graph.markDirty(this._index, DIRTY_TRANSFORM)
  }

  get y() {
    this._checkAlive()
    return this._graph.matrix[this._index * MAT_SIZE + MAT_TY]
  }
  set y(v: number) {
    this._checkAlive()
    this._graph.matrix[this._index * MAT_SIZE + MAT_TY] = v
    this._graph.markDirty(this._index, DIRTY_TRANSFORM)
  }

  get width() {
    this._checkAlive()
    return this._graph.size[this._index * 2]
  }
  set width(v: number) {
    this._checkAlive()
    this._graph.size[this._index * 2] = v
    this._graph.markDirty(this._index, DIRTY_TRANSFORM)
  }

  get height() {
    this._checkAlive()
    return this._graph.size[this._index * 2 + 1]
  }
  set height(v: number) {
    this._checkAlive()
    this._graph.size[this._index * 2 + 1] = v
    this._graph.markDirty(this._index, DIRTY_TRANSFORM)
  }

  // --- 树形操作 ---

  get parent() {
    this._checkAlive()
    const pIdx = this._graph.parent[this._index]
    return pIdx !== NULL_INDEX ? new NodeCursor(this._graph, pIdx) : null
  }

  public appendChild(child: NodeCursor) {
    this._checkAlive()
    // 委托给 SceneGraph 处理复杂的指针操作
    this._graph.appendChild(this._index, child.index)
  }

  public remove() {
    this._checkAlive()
    this._graph.deleteNode(this._index)
  }

  /**
   * 子节点迭代器
   * 用法: for (const child of node.children())
   */
  public *children() {
    this._checkAlive()

    let curr = this._graph.firstChild[this._index]
    // 安全计数器
    let safeguard = 0

    while (curr !== NULL_INDEX) {
      if (safeguard++ > 1_000_000) throw new Error('Tree cycle detected')

      // 产出游标
      yield new NodeCursor(this._graph, curr)

      // 移动指针
      curr = this._graph.nextSibling[curr]
    }
  }
}
