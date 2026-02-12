import {
  DIRTY_AABB,
  DIRTY_NOT_EFFECT,
  DIRTY_STRUCTURE,
  DIRTY_TRANSFORM,
  MAX_NODES,
  NULL_INDEX,
} from './config'
import { HierarchyOps, StyleOps, TransformOps } from './ops'
import { PropId } from './propKeys'

import type {
  DashCapKey,
  IDType,
  IPaint,
  StrokeAlignKey,
  StrokeJoinKey,
  StrokeStyleKey,
} from '@latte-js/bean'
import { mat2d } from 'gl-matrix'
import type { SceneGraph } from './sceneGraph'

export class NodeCursor {
  private _index: number
  private _generation: number

  private _transform = mat2d.create()
  private _worldTransform = mat2d.create()

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

  public toID(id: IDType): this {
    const index = this._graph.getIndex(id)
    if (index === -1) throw new Error(`Node not found: ${id}`)

    this.to(index)
    return this
  }

  private _mutate(prop: PropId, dirtyFlag: number, executor: () => void) {
    const oldVal = this[prop]
    executor()
    const newValue = this[prop]
    this._graph.notifyObservers(this.id!, prop, oldVal, newValue)

    this._graph.markDirty(this.index, dirtyFlag)
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
    this._mutate(PropId.NAME, DIRTY_NOT_EFFECT, () => {
      this._graph.nameMap.set(this._index, v)
    })
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
    this._mutate(PropId.X, DIRTY_TRANSFORM, () => {
      TransformOps.setX(this._graph, this._index, v)
    })
  }

  get y() {
    this._checkAlive()
    return TransformOps.getY(this._graph, this._index)
  }
  set y(v: number) {
    this._checkAlive()
    this._mutate(PropId.Y, DIRTY_TRANSFORM, () => {
      TransformOps.setY(this._graph, this._index, v)
    })
  }

  get width() {
    this._checkAlive()
    return TransformOps.getWidth(this._graph, this._index)
  }
  set width(v: number) {
    this._checkAlive()
    this._mutate(PropId.WIDTH, DIRTY_TRANSFORM, () => {
      TransformOps.setWidth(this._graph, this._index, v)
    })
  }

  get height() {
    this._checkAlive()
    return TransformOps.getHeight(this._graph, this._index)
  }
  set height(v: number) {
    this._checkAlive()
    this._mutate(PropId.HEIGHT, DIRTY_TRANSFORM, () => {
      TransformOps.setHeight(this._graph, this._index, v)
    })
  }

  get transform() {
    return TransformOps.getMatrix(this._graph, this._index, this._transform)
  }

  set transform(mat: mat2d) {
    this._mutate(PropId.TRANSFORM, DIRTY_TRANSFORM, () => {
      TransformOps.setMatrix(this._graph, this._index, mat)
    })
  }

  get worldTransform() {
    this._checkAlive()
    const out = TransformOps.getWorldMatrix(
      this._graph,
      this._index,
      this._worldTransform
    )
    return out
  }

  set worldTransform(mat: mat2d) {
    this._checkAlive()
    this._mutate(PropId.WORLD_TRANSFORM, DIRTY_TRANSFORM, () => {
      TransformOps.setWorldMatrix(this._graph, this._index, mat)
    })
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
    this._mutate(PropId.LOCKED, DIRTY_NOT_EFFECT, () => {
      StyleOps.setLocked(this._graph, this._index, v)
    })
  }

  get visible() {
    this._checkAlive()
    return StyleOps.getVisible(this._graph, this._index)
  }

  set visible(v: boolean) {
    this._checkAlive()
    this._mutate(PropId.VISIBLE, DIRTY_NOT_EFFECT, () => {
      StyleOps.setVisible(this._graph, this._index, v)
    })
  }

  get opacity() {
    this._checkAlive()
    return StyleOps.getOpacity(this._graph, this._index)
  }

  set opacity(v: number) {
    this._checkAlive()
    this._mutate(PropId.OPACITY, DIRTY_NOT_EFFECT, () => {
      StyleOps.setOpacity(this._graph, this._index, v)
    })
  }

  get parent() {
    this._checkAlive()
    const pIdx = HierarchyOps.getParent(this._graph, this._index)
    return pIdx !== NULL_INDEX ? new NodeCursor(this._graph, pIdx) : null
  }

  public appendChild(child: NodeCursor) {
    this._checkAlive()
    const oldParent = child.parent?.id ?? null
    HierarchyOps.appendChild(this._graph, this._index, child.index)
    const newParent = child.parent?.id ?? null
    this._graph.notifyObservers(child.id!, PropId.PARENT, oldParent, newParent)
    this._graph.markDirty(child.index, DIRTY_TRANSFORM)
    this._graph.markDirty(this._index, DIRTY_STRUCTURE)
  }

  public removeChild(child: NodeCursor) {
    if (child.parent?.index !== this._index) {
      throw new Error('[NodeCursor] removeChild: not a child of this node')
    }
    this._checkAlive()
    HierarchyOps.detach(this._graph, child.index)
    this._graph.notifyObservers(child.id!, PropId.PARENT, this.id, null)
    this._graph.markDirty(this._index, DIRTY_STRUCTURE)
    return child
  }

  public delete() {
    this._checkAlive()
    const myId = this.id
    const parent = this.parent
    HierarchyOps.remove(this._graph, this._index)
    //FIXME：json serialization
    const nodeJSON = ''
    this._graph.notifyObservers(myId!, PropId.REMOVE_SELF, nodeJSON, null)
    if (parent) {
      this._graph.markDirty(parent.index, DIRTY_STRUCTURE)
    }
  }

  get fills() {
    return StyleOps.getFills(this._graph, this._index)
  }

  set fills(style: IPaint[]) {
    this._mutate(PropId.FILLS, DIRTY_NOT_EFFECT, () => {
      StyleOps.setFills(this._graph, this._index, style)
    })
  }

  get strokes() {
    return StyleOps.getStrokes(this._graph, this._index)
  }

  set strokes(style: IPaint[]) {
    this._mutate(PropId.STROKES, DIRTY_NOT_EFFECT, () => {
      StyleOps.setStrokes(this._graph, this._index, style)
    })
  }

  get cornerRadius(): [number, number, number, number] {
    this._checkAlive()
    return StyleOps.getCornerRadius(this._graph, this._index)
  }

  set cornerRadius(v: [number, number, number, number]) {
    this._checkAlive()
    this._mutate(PropId.CORNER_RADIUS, DIRTY_AABB, () => {
      StyleOps.setCornerRadius(this._graph, this._index, v)
    })
  }

  // Zero-alloc version - writes into provided buffer
  getCornerRadiusInto(out: Float32Array): Float32Array {
    this._checkAlive()
    return StyleOps.getCornerRadiusInto(this._graph, this._index, out)
  }

  get strokeWeight() {
    this._checkAlive()
    return StyleOps.getStrokeWeight(this._graph, this._index)
  }

  set strokeWeight(v: number) {
    this._checkAlive()
    this._mutate(PropId.STROKE_WEIGHT, DIRTY_AABB, () => {
      StyleOps.setStrokeWeight(this._graph, this._index, v)
    })
  }

  get strokeAlign(): StrokeAlignKey {
    this._checkAlive()
    return StyleOps.getStrokeAlign(this._graph, this._index)
  }

  set strokeAlign(v: StrokeAlignKey) {
    this._checkAlive()
    this._mutate(PropId.STROKES, DIRTY_TRANSFORM, () => {
      StyleOps.setStrokeAlign(this._graph, this._index, v)
    })
  }

  get strokeJoin(): StrokeJoinKey {
    this._checkAlive()
    return StyleOps.getStrokeJoin(this._graph, this._index)
  }

  set strokeJoin(v: StrokeJoinKey) {
    this._checkAlive()
    this._mutate(PropId.STROKE_JOIN, DIRTY_TRANSFORM, () => {
      StyleOps.setStrokeJoin(this._graph, this._index, v)
    })
  }

  get strokeStyle(): StrokeStyleKey {
    this._checkAlive()
    return StyleOps.getStrokeStyle(this._graph, this._index)
  }

  set strokeStyle(v: StrokeStyleKey) {
    this._checkAlive()
    this._mutate(PropId.STROKE_STYLE, DIRTY_NOT_EFFECT, () => {
      StyleOps.setStrokeStyle(this._graph, this._index, v)
    })
  }

  get dashCap(): DashCapKey {
    this._checkAlive()
    return StyleOps.getDashCap(this._graph, this._index)
  }

  set dashCap(v: DashCapKey) {
    this._checkAlive()
    this._mutate(PropId.DASH_CAP, DIRTY_TRANSFORM, () => {
      StyleOps.setDashCap(this._graph, this._index, v)
    })
  }
}
