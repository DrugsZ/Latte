import { NodeType, type AABB } from '@latte-js/bean'
import {
  BOUNDS_AFFECTING_FLAGS,
  MAX_NODES,
  NULL_INDEX,
  TransformOps,
} from '@latte-js/espresso'

import type { DirtyBatch } from '../pipeline/dirtyBatch'
import { ScheduleStage, System, SystemBase, Systems } from './systems'

/**
 * AABBSystem - Computes hierarchy AABB (self ∪ all children) for affected nodes.
 *
 * Builds the affected ancestor closure and updates it in post-order so each
 * parent reads fresh AABBs from affected children and cached AABBs from
 * unaffected children.
 */
@System({
  schedule: {
    stage: ScheduleStage.Bounds,
    reads: BOUNDS_AFFECTING_FLAGS,
  },
})
export class AABBSystem extends SystemBase {
  public static readonly name = Systems.AABB
  private _tempAABB: AABB = Float32Array.from({ length: 4 })
  private _childAABB: AABB = Float32Array.from({ length: 4 })

  private get _cursor() {
    return this._getCursor('aabb', -1)
  }

  public process(batch: DirtyBatch) {
    if (!batch.hasChanges) return

    const affected = this._collectAffectedClosure(batch)

    if (affected.size === 0) return

    const roots = this._collectAffectedRoots(affected)
    const updated = new Set<number>()

    for (const root of roots) {
      this._updateAffectedPostOrder(root, affected, updated, new Set())
    }
  }

  private _collectAffectedClosure(batch: DirtyBatch) {
    const affected = new Set<number>()

    for (const [index] of batch.entriesByMask(BOUNDS_AFFECTING_FLAGS)) {
      this._collectAncestors(index, affected)
    }

    return affected
  }

  private _collectAncestors(index: number, affected: Set<number>) {
    const visited = new Set<number>()
    let current = index

    while (current !== NULL_INDEX) {
      if (visited.has(current) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${current}`)
      }
      if (!this._sceneGraph.isNodeIndexAlive(current)) {
        return
      }

      visited.add(current)
      affected.add(current)
      current = this._sceneGraph.parent[current]
    }
  }

  private _collectAffectedRoots(affected: Set<number>) {
    const roots: number[] = []

    for (const index of affected) {
      const parent = this._sceneGraph.parent[index]
      if (parent === NULL_INDEX || !affected.has(parent)) {
        roots.push(index)
      }
    }

    if (roots.length === 0 && affected.size > 0) {
      throw new Error('Tree cycle detected in affected AABB roots')
    }

    return roots
  }

  private _updateAffectedPostOrder(
    index: number,
    affected: Set<number>,
    updated: Set<number>,
    visiting: Set<number>
  ) {
    if (updated.has(index)) return
    if (visiting.has(index) || visiting.size > MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${index}`)
    }

    visiting.add(index)
    try {
      let child = this._sceneGraph.firstChild[index]
      const visitedChildren = new Set<number>()

      while (child !== NULL_INDEX) {
        if (visitedChildren.has(child) || visitedChildren.size > MAX_NODES) {
          throw new Error(`Tree cycle detected at node ${child}`)
        }
        if (!this._sceneGraph.isNodeIndexAlive(child)) {
          throw new Error(`Invalid child node in AABB traversal: ${child}`)
        }

        visitedChildren.add(child)
        const next = this._sceneGraph.nextSibling[child]
        if (affected.has(child)) {
          this._updateAffectedPostOrder(child, affected, updated, visiting)
        }
        child = next
      }

      this._cursor.to(index)
      this._updateHierarchyAABB()
      updated.add(index)
    } finally {
      visiting.delete(index)
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
