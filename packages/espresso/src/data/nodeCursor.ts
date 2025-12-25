import type {
  StrokeAlignKey,
  StrokeJoinKey,
  StrokeStyleKey,
  DashCapKey,
  IPaint,
} from '@latte-js/bean'

import type { mat2d } from 'gl-matrix'
import { DIRTY_TRANSFORM, MAX_NODES, NULL_INDEX } from './config'
import { HierarchyOps, TransformOps, StyleOps } from './ops'
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

  // region style start

  get locked() {
    this._checkAlive()
    return StyleOps.getLocked(this._graph, this._index)
  }

  set locked(v: boolean) {
    this._checkAlive()
    StyleOps.setLocked(this._graph, this._index, v)
  }

  get visible() {
    this._checkAlive()
    return StyleOps.getVisible(this._graph, this._index)
  }

  set visible(v: boolean) {
    this._checkAlive()
    StyleOps.setVisible(this._graph, this._index, v)
  }

  get opacity() {
    this._checkAlive()
    return StyleOps.getOpacity(this._graph, this._index)
  }

  set opacity(v: number) {
    this._checkAlive()
    StyleOps.setOpacity(this._graph, this._index, v)
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
    HierarchyOps.detach(this._graph, this._index)
  }

  public delete() {
    this._checkAlive()
    HierarchyOps.remove(this._graph, this._index)
  }

  get fills() {
    return StyleOps.getFills(this._graph, this._index)
  }

  set fills(style: IPaint[]) {
    StyleOps.setStyle(this._graph, this._index, style)
  }

  get strokeWeight() {
    this._checkAlive()
    return StyleOps.getStrokeWeight(this._graph, this._index)
  }

  set strokeWeight(v: number) {
    this._checkAlive()
    StyleOps.setStrokeWeight(this._graph, this._index, v)
  }

  get strokeAlign(): StrokeAlignKey {
    this._checkAlive()
    return StyleOps.getStrokeAlign(this._graph, this._index)
  }

  set strokeAlign(v: StrokeAlignKey) {
    this._checkAlive()
    StyleOps.setStrokeAlign(this._graph, this._index, v)
  }

  get strokeJoin(): StrokeJoinKey {
    this._checkAlive()
    return StyleOps.getStrokeJoin(this._graph, this._index)
  }

  set strokeJoin(v: StrokeJoinKey) {
    this._checkAlive()
    StyleOps.setStrokeJoin(this._graph, this._index, v)
  }

  get strokeStyle(): StrokeStyleKey {
    this._checkAlive()
    return StyleOps.getStrokeStyle(this._graph, this._index)
  }

  set strokeStyle(v: StrokeStyleKey) {
    this._checkAlive()
    StyleOps.setStrokeStyle(this._graph, this._index, v)
  }

  get dashCap(): DashCapKey {
    this._checkAlive()
    return StyleOps.getDashCap(this._graph, this._index)
  }

  set dashCap(v: DashCapKey) {
    this._checkAlive()
    StyleOps.setDashCap(this._graph, this._index, v)
  }

  // region style end
}
