import type { SceneGraph } from './sceneGraph'
import type { StrokeAlignKey } from '@latte-js/bean'
import { StrokeAlign } from '@latte-js/bean'
import {
  NULL_INDEX,
  MAT_TX,
  MAT_TY,
  MAT_SIZE,
  DIRTY_TRANSFORM,
  MAX_NODES,
} from './config'

export class NodeCursor {
  private readonly _index: number
  private readonly _generation: number

  constructor(
    private _graph: SceneGraph,
    index: number
  ) {
    this._index = index
    this._generation = _graph.allocator.generations[index]
  }

  private _checkAlive() {
    if (!this._graph.allocator.isValid(this._index, this._generation)) {
      throw new Error(`[NodeCursor] Accessing dead node: ${this._index}`)
    }
  }

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
  }

  get x() {
    this._checkAlive()
    return this._graph.matrix[this._index * MAT_SIZE + MAT_TX]
  }
  set x(v: number) {
    this._checkAlive()
    this._graph.matrix[this._index * MAT_SIZE + MAT_TX] = v
  }

  get y() {
    this._checkAlive()
    return this._graph.matrix[this._index * MAT_SIZE + MAT_TY]
  }
  set y(v: number) {
    this._checkAlive()
    this._graph.matrix[this._index * MAT_SIZE + MAT_TY] = v
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

  get locked() {
    this._checkAlive()
    return this._graph.locked[this._index] === 1
  }

  set locked(v: boolean) {
    this._checkAlive()
    this._graph.locked[this._index] = v ? 1 : 0
  }

  get visible() {
    this._checkAlive()
    return this._graph.visible[this._index] === 1
  }

  set visible(v: boolean) {
    this._checkAlive()
    this._graph.visible[this._index] = v ? 1 : 0
  }

  get opacity() {
    this._checkAlive()
    return this._graph.opacity[this._index]
  }

  set opacity(v: number) {
    this._checkAlive()
    this._graph.opacity[this._index] = v
  }

  get strokeWIdth() {
    this._checkAlive()
    return this._graph.strokeWeight[this._index]
  }

  set strokeWIdth(v: number) {
    this._checkAlive()
    this._graph.strokeWeight[this._index] = v
  }

  get strokeAlign(): StrokeAlignKey {
    this._checkAlive()
    return StrokeAlign[this._graph.strokeAlign[this._index]] as StrokeAlignKey
  }

  set strokeAlign(v: StrokeAlignKey) {
    this._checkAlive()
    this._graph.strokeAlign[this._index] = StrokeAlign[v]
  }

  get parent() {
    this._checkAlive()
    const pIdx = this._graph.parent[this._index]
    return pIdx !== NULL_INDEX ? new NodeCursor(this._graph, pIdx) : null
  }

  public appendChild(child: NodeCursor) {
    this._checkAlive()
    this._graph.appendChild(this._index, child.index)
  }

  public remove() {
    this._checkAlive()
    this._graph.deleteNode(this._index)
  }

  public *children() {
    this._checkAlive()

    let curr = this._graph.firstChild[this._index]
    let safeguard = 0

    while (curr !== NULL_INDEX) {
      if (safeguard++ > MAX_NODES) throw new Error('Tree cycle detected')

      yield new NodeCursor(this._graph, curr)

      curr = this._graph.nextSibling[curr]
    }
  }
}
