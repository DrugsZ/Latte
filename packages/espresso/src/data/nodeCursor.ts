import type { StrokeAlignKey } from '@latte-js/bean'
import { StrokeAlign } from '@latte-js/bean'
import type { mat2d } from 'gl-matrix'
import { DIRTY_TRANSFORM, MAX_NODES, NULL_INDEX } from './config'
import { HierarchyOps, TransformOps } from './ops'
import type { SceneGraph } from './sceneGraph'

export class NodeCursor {
  private _index: number
  private _generation: number

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

  public to(idx: number) {
    const oldIndex = this._index
    const oldGeneration = this._generation

    this._index = idx
    this._generation = this._graph.allocator.generations[idx]

    try {
      this._checkAlive()
    } catch (e) {
      this._index = oldIndex
      this._generation = oldGeneration
      throw e
    }

    return this
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
  public *children(flyweight = true) {
    this._checkAlive()

    let curr = this._graph.firstChild[this._index]
    let safeguard = 0

    if (flyweight) {
      const scratch = new NodeCursor(this._graph, this._index)
      while (curr !== NULL_INDEX) {
        if (safeguard++ > MAX_NODES) throw new Error('Tree cycle detected')
        yield scratch.to(curr)
        curr = this._graph.nextSibling[curr]
      }
      return
    }

    while (curr !== NULL_INDEX) {
      if (safeguard++ > MAX_NODES) throw new Error('Tree cycle detected')
      yield new NodeCursor(this._graph, curr)
      curr = this._graph.nextSibling[curr]
    }
  }

  // region transform start
  get x() {
    this._checkAlive()
    return TransformOps.getX(this._graph, this._index)
  }
  set x(v: number) {
    this._checkAlive()
    TransformOps.setX(this._graph, this._index, v)
  }

  get y() {
    this._checkAlive()
    return TransformOps.getY(this._graph, this._index)
  }
  set y(v: number) {
    this._checkAlive()
    TransformOps.setY(this._graph, this._index, v)
  }

  get width() {
    this._checkAlive()
    return TransformOps.getWidth(this._graph, this._index)
  }
  set width(v: number) {
    this._checkAlive()
    TransformOps.setWidth(this._graph, this._index, v)
    this._graph.markDirty(this._index, DIRTY_TRANSFORM)
  }

  get height() {
    this._checkAlive()
    return TransformOps.getHeight(this._graph, this._index)
  }
  set height(v: number) {
    this._checkAlive()
    TransformOps.setHeight(this._graph, this._index, v)
    this._graph.markDirty(this._index, DIRTY_TRANSFORM)
  }

  get transform() {
    return TransformOps.getMatrix(this._graph, this._index)
  }

  set transform(mat: mat2d) {
    TransformOps.setMatrix(this._graph, this._index, mat)
  }

  resetTransform() {
    TransformOps.identityMatrix(this._graph, this._index)
  }

  // region transform end

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
    const pIdx = HierarchyOps.getParent(this._graph, this._index)
    return pIdx !== NULL_INDEX ? new NodeCursor(this._graph, pIdx) : null
  }

  public appendChild(child: NodeCursor) {
    this._checkAlive()
    HierarchyOps.appendChild(this._graph, this._index, child.index)
  }

  public remove() {
    this._checkAlive()
    HierarchyOps.remove(this._graph, this._index)
  }

  get style() {
    const ptr = this._graph.blobIndexToPtr.get(this._index)
    if (!ptr) {
      return {}
    }
    return this._graph.blobs.read(ptr) || {}
  }

  set style(style: object) {
    const ptr = this._graph.blobs.write(style)
    this._graph.blobIndexToPtr.set(this._index, ptr)
  }
}
