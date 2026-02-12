import {
  type SceneGraph,
  DIRTY_AABB,
  DIRTY_SUBTREE_MATRIX,
  DIRTY_TRANSFORM,
  NodeCursor,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'

import { system, SystemBase, Systems } from './systems'

/**
 * MatrixSystem - Computes world transform matrices using DIRTY_SUBTREE_MATRIX pruning.
 *
 * Traverses top-down (pre-order), skipping subtrees without transform changes.
 * Marks updated nodes with DIRTY_AABB for AABBSystem to process.
 */
@system
export class MatrixSystem extends SystemBase {
  public static readonly name = Systems.Matrix
  private _cursor: NodeCursor

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, -1)
  }

  public process(dirtyMap: Map<number, number>) {
    if (dirtyMap.size === 0) return

    const processed = new Set<number>()

    for (const nodeIndex of dirtyMap.keys()) {
      if (!processed.has(nodeIndex)) {
        this._processNodeWithAncestors(nodeIndex, dirtyMap, processed)
      }
    }
  }

  private _processNodeWithAncestors(
    index: number,
    dirtyMap: Map<number, number>,
    processed: Set<number>
  ) {
    if (processed.has(index)) return

    this._cursor.to(index)
    const parent = this._cursor.parent

    if (
      parent !== null &&
      dirtyMap.has(parent.index) &&
      !processed.has(parent.index)
    ) {
      this._processNodeWithAncestors(parent.index, dirtyMap, processed)
    }

    const parentDirty = parent !== null && processed.has(parent.index)
    this._processSubtree(index, parentDirty, dirtyMap, processed)
  }

  private _processSubtree(
    index: number,
    parentDirty: boolean,
    dirtyMap: Map<number, number>,
    processed: Set<number>
  ) {
    const flags = dirtyMap.get(index) || 0
    const hasDirtyTransform = (flags & DIRTY_TRANSFORM) !== 0
    const hasDirtySubtree = (flags & DIRTY_SUBTREE_MATRIX) !== 0

    if (!parentDirty && !hasDirtyTransform && !hasDirtySubtree) {
      return
    }

    this._cursor.to(index)
    processed.add(index)

    const mustUpdate = hasDirtyTransform || parentDirty

    if (mustUpdate) {
      this._updateWorldTransform()
      // Mark for AABB recalculation
      const currentFlags = dirtyMap.get(index) || 0
      dirtyMap.set(index, currentFlags | DIRTY_AABB)
    }

    if (hasDirtySubtree || mustUpdate) {
      for (const child of this._cursor.children()) {
        this._processSubtree(child.index, mustUpdate, dirtyMap, processed)
      }
    }
  }

  private _updateWorldTransform() {
    const parent = this._cursor.parent

    if (parent === null) {
      this._cursor.worldTransform = mat2d.clone(this._cursor.transform)
    } else {
      this._cursor.worldTransform = mat2d.multiply(
        mat2d.create(),
        parent.worldTransform,
        this._cursor.transform
      )
    }
  }
}
