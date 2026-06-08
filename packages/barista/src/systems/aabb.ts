import { NodeType, type AABB } from '@latte-js/bean'
import {
  BOUNDS_AFFECTING_FLAGS,
  MAX_NODES,
  NodeCursor,
  NULL_INDEX,
  TransformOps,
  type SceneGraph,
} from '@latte-js/espresso'

import type { DirtyBatch } from '../pipeline/dirtyBatch'
import { ScheduleStage, system, SystemBase, Systems } from './systems'

interface DirtyNode {
  index: number
  depth: number
}

/**
 * AABBSystem - Computes hierarchy AABB (self ∪ all children) using bottom-up approach.
 *
 * Collects all bounds-dirty nodes, sorts by depth (deepest first), then updates upward.
 * O(dirty nodes × depth) complexity without needing DIRTY_SUBTREE_BOUNDS.
 */
@system({
  schedule: {
    stage: ScheduleStage.Bounds,
    reads: BOUNDS_AFFECTING_FLAGS,
  },
})
export class AABBSystem extends SystemBase {
  public static readonly name = Systems.AABB
  private _cursor: NodeCursor
  private _tempAABB: AABB = Float32Array.from({ length: 4 })
  private _childAABB: AABB = Float32Array.from({ length: 4 })

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, -1)
  }

  public process(batch: DirtyBatch) {
    if (!batch.hasChanges) return

    // Step 1: Collect all bounds-dirty nodes with their depths
    const dirtyNodes = this._collectDirtyNodes(batch)

    if (dirtyNodes.length === 0) return

    // Step 2: Sort by depth descending (deepest first)
    dirtyNodes.sort((a, b) => b.depth - a.depth)

    // Step 3: Update from bottom to top, tracking already updated nodes
    const updated = new Set<number>()
    for (const { index } of dirtyNodes) {
      this._updateBottomUp(index, updated)
    }
  }

  private _collectDirtyNodes(batch: DirtyBatch): DirtyNode[] {
    const result: DirtyNode[] = []

    for (const [index] of batch.entriesByMask(BOUNDS_AFFECTING_FLAGS)) {
      result.push({ index, depth: this._getDepth(index) })
    }

    return result
  }

  private _getDepth(index: number): number {
    let depth = 0
    const visited = new Set<number>()
    this._cursor.to(index)
    let parent = this._cursor.parent
    while (parent !== null) {
      if (visited.has(parent.index) || depth > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${parent.index}`)
      }
      visited.add(parent.index)
      depth++
      parent = parent.parent
    }
    return depth
  }

  private _updateBottomUp(index: number, updated: Set<number>) {
    let current = index
    const visited = new Set<number>()

    while (current !== NULL_INDEX) {
      if (visited.has(current) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${current}`)
      }
      visited.add(current)
      if (updated.has(current)) {
        // Already updated, ancestors are also updated
        break
      }

      this._cursor.to(current)
      this._updateHierarchyAABB()
      updated.add(current)

      const parent = this._cursor.parent
      current = parent !== null ? parent.index : NULL_INDEX
    }
  }

  private _updateHierarchyAABB() {
    this._computeSelfAABB()

    let hasValidChild = false
    for (const child of this._cursor.children(false)) {
      TransformOps.getAABB(this._sceneGraph, child.index, this._childAABB)
      if (
        this._childAABB[0] <= this._childAABB[2] &&
        this._childAABB[1] <= this._childAABB[3]
      ) {
        this._mergeAABB(this._tempAABB, this._childAABB)
        hasValidChild = true
      }
    }

    // If it's a group and has no children (or no valid children), reset to a point AABB [0,0,0,0]
    if (this._cursor.type === NodeType.GROUP && !hasValidChild) {
      this._tempAABB[0] = 0
      this._tempAABB[1] = 0
      this._tempAABB[2] = 0
      this._tempAABB[3] = 0
    }

    TransformOps.setAABB(this._sceneGraph, this._cursor.index, this._tempAABB)
  }

  private _computeSelfAABB() {
    const type = this._cursor.type

    if (type === NodeType.DOCUMENT || type === NodeType.CANVAS) {
      // Pages are theoretically infinite
      this._tempAABB[0] = -1e10
      this._tempAABB[1] = -1e10
      this._tempAABB[2] = 1e10
      this._tempAABB[3] = 1e10
      return
    }

    if (type === NodeType.GROUP) {
      // Strictly follow children (starts as an empty/invalid AABB)
      this._tempAABB[0] = 1e10
      this._tempAABB[1] = 1e10
      this._tempAABB[2] = -1e10
      this._tempAABB[3] = -1e10
      return
    }

    const { width, height, worldTransform } = this._cursor

    const corners = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ]

    let minX = 1e10,
      minY = 1e10
    let maxX = -1e10,
      maxY = -1e10

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
