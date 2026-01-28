import { NodeType, type AABB } from '@latte-js/bean'
import {
  type SceneGraph,
  BOUNDS_AFFECTING_FLAGS,
  DIRTY_SUBTREE_BOUNDS,
  NodeCursor,
  TransformOps,
} from '@latte-js/espresso'
import { system, Systems, SystemBase } from './systems'

/**
 * AABBSystem - Computes hierarchy AABB (self ∪ all children) using post-order traversal.
 *
 * Uses DIRTY_SUBTREE_BOUNDS pruning for O(dirty nodes × depth) complexity.
 */
@system
export class AABBSystem extends SystemBase {
  public static readonly name = Systems.AABB
  private _cursor: NodeCursor
  private _tempAABB: AABB = Float32Array.from({ length: 4 })
  private _childAABB: AABB = Float32Array.from({ length: 4 })

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, -1)
  }

  public process(dirtyMap: Map<number, number>) {
    if (dirtyMap.size === 0) return
    this._processSubtree(0, false, dirtyMap)
  }

  private _processSubtree(
    index: number,
    parentDirty: boolean,
    dirtyMap: Map<number, number>
  ): boolean {
    const flags = dirtyMap.get(index) || 0
    const hasBoundsDirty = (flags & BOUNDS_AFFECTING_FLAGS) !== 0
    const hasDirtySubtree = (flags & DIRTY_SUBTREE_BOUNDS) !== 0

    if (!parentDirty && !hasBoundsDirty && !hasDirtySubtree) {
      return false
    }

    this._cursor.to(index)

    const selfDirty = hasBoundsDirty || parentDirty

    let childrenChanged = false
    for (const child of this._cursor.children()) {
      if (this._processSubtree(child.index, selfDirty, dirtyMap)) {
        childrenChanged = true
      }
    }

    if (selfDirty || childrenChanged) {
      this._updateHierarchyAABB()
      return true
    }

    return false
  }

  private _updateHierarchyAABB() {
    this._computeSelfAABB()

    for (const child of this._cursor.children()) {
      TransformOps.getAABB(this._sceneGraph, child.index, this._childAABB)
      this._mergeAABB(this._tempAABB, this._childAABB)
    }

    TransformOps.setAABB(this._sceneGraph, this._cursor.index, this._tempAABB)
  }

  private _computeSelfAABB() {
    const type = this._cursor.type

    if (type & NodeType.DOCUMENT) {
      this._tempAABB[0] = Infinity
      this._tempAABB[1] = Infinity
      this._tempAABB[2] = -Infinity
      this._tempAABB[3] = -Infinity
      return
    }

    const { width, height, worldTransform } = this._cursor

    const corners = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ]

    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const [cx, cy] of corners) {
      const tx =
        worldTransform[0] * cx + worldTransform[2] * cy + worldTransform[4]
      const ty =
        worldTransform[1] * cx + worldTransform[3] * cy + worldTransform[5]

      minX = Math.min(minX, tx)
      minY = Math.min(minY, ty)
      maxX = Math.max(maxX, tx)
      maxY = Math.max(maxY, ty)
    }

    this._tempAABB[0] = minX
    this._tempAABB[1] = minY
    this._tempAABB[2] = maxX
    this._tempAABB[3] = maxY
  }

  private _mergeAABB(target: AABB, source: AABB) {
    if (source[0] > source[2] || source[1] > source[3]) {
      return
    }
    target[0] = Math.min(target[0], source[0])
    target[1] = Math.min(target[1], source[1])
    target[2] = Math.max(target[2], source[2])
    target[3] = Math.max(target[3], source[3])
  }
}
