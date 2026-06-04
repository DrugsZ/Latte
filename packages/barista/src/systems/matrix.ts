import {
  type SceneGraph,
  DIRTY_AABB,
  DIRTY_SUBTREE_MATRIX,
  DIRTY_TRANSFORM,
  MAX_NODES,
  NodeCursor,
  TransformOps,
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
  private _tempMatrix: mat2d = mat2d.create()
  private _parentMatrix: mat2d = mat2d.create()
  private _localMatrix: mat2d = mat2d.create()

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, -1)
  }

  public process(dirtyMap: Map<number, number>) {
    if (dirtyMap.size === 0) return
    this._processSubtree(0, false, dirtyMap, new Set())
  }

  private _processSubtree(
    index: number,
    parentDirty: boolean,
    dirtyMap: Map<number, number>,
    path: Set<number>
  ) {
    if (path.has(index) || path.size > MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${index}`)
    }

    const flags = dirtyMap.get(index) || 0
    const hasDirtyTransform = (flags & DIRTY_TRANSFORM) !== 0
    const hasDirtySubtree = (flags & DIRTY_SUBTREE_MATRIX) !== 0

    if (!parentDirty && !hasDirtyTransform && !hasDirtySubtree) {
      return
    }

    path.add(index)
    this._cursor.to(index)

    const mustUpdate = hasDirtyTransform || parentDirty

    if (mustUpdate) {
      this._updateWorldTransform()
      // Mark for AABB recalculation
      const currentFlags = dirtyMap.get(index) || 0
      dirtyMap.set(index, currentFlags | DIRTY_AABB)
    }

    for (const child of this._cursor.children(false)) {
      this._processSubtree(child.index, mustUpdate, dirtyMap, path)
    }
    path.delete(index)
  }

  private _updateWorldTransform() {
    const parent = this._cursor.parent

    if (parent === null) {
      TransformOps.setWorldMatrix(
        this._sceneGraph,
        this._cursor.index,
        this._cursor.transform
      )
    } else {
      mat2d.copy(this._parentMatrix, parent.worldTransform)
      mat2d.copy(this._localMatrix, this._cursor.transform)
      mat2d.multiply(this._tempMatrix, this._parentMatrix, this._localMatrix)
      TransformOps.setWorldMatrix(
        this._sceneGraph,
        this._cursor.index,
        this._tempMatrix
      )
    }
  }
}
