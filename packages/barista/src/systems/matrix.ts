import {
  type SceneGraph,
  DIRTY_WORLD_BOUNDS,
  DIRTY_SUBTREE_MATRIX,
  MATRIX_AFFECTING_FLAGS,
  MAX_NODES,
  NodeCursor,
  TransformOps,
} from '@latte-js/espresso'
import { mat2d } from 'gl-matrix'

import type { DirtyBatch } from '../pipeline/dirtyBatch'
import { ScheduleStage, system, SystemBase, Systems } from './systems'

const MATRIX_SCHEDULE_READS = MATRIX_AFFECTING_FLAGS | DIRTY_SUBTREE_MATRIX

/**
 * MatrixSystem - Computes world transform matrices using DIRTY_SUBTREE_MATRIX pruning.
 *
 * Traverses top-down, skipping subtrees without transform changes.
 * Marks updated nodes with DIRTY_WORLD_BOUNDS for AABBSystem to process.
 */
@system({
  schedule: {
    stage: ScheduleStage.Matrix,
    reads: MATRIX_SCHEDULE_READS,
    writes: DIRTY_WORLD_BOUNDS,
  },
})
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

  public process(batch: DirtyBatch) {
    if (!batch.hasChanges) return

    const processed = new Set<number>()

    for (const nodeIndex of batch.keysByMask(MATRIX_SCHEDULE_READS)) {
      if (!processed.has(nodeIndex)) {
        this._processNodeWithAncestors(nodeIndex, batch, processed, new Set())
      }
    }
  }

  private _processNodeWithAncestors(
    index: number,
    batch: DirtyBatch,
    processed: Set<number>,
    path: Set<number>
  ) {
    if (processed.has(index)) return
    if (path.has(index) || path.size > MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${index}`)
    }

    path.add(index)
    this._cursor.to(index)
    const parent = this._cursor.parent

    if (
      parent !== null &&
      batch.has(parent.index) &&
      !processed.has(parent.index)
    ) {
      this._processNodeWithAncestors(parent.index, batch, processed, path)
    }

    path.delete(index)
    const parentDirty = parent !== null && processed.has(parent.index)
    this._processSubtree(index, parentDirty, batch, processed, new Set())
  }

  private _processSubtree(
    index: number,
    parentDirty: boolean,
    batch: DirtyBatch,
    processed: Set<number>,
    path: Set<number>
  ) {
    if (path.has(index) || path.size > MAX_NODES) {
      throw new Error(`Tree cycle detected at node ${index}`)
    }

    const flags = batch.getFlags(index)
    const hasMatrixInputChange = (flags & MATRIX_AFFECTING_FLAGS) !== 0
    const hasDirtySubtree = (flags & DIRTY_SUBTREE_MATRIX) !== 0

    if (!parentDirty && !hasMatrixInputChange && !hasDirtySubtree) {
      return
    }

    path.add(index)
    this._cursor.to(index)
    processed.add(index)

    const mustUpdate = hasMatrixInputChange || parentDirty

    if (mustUpdate) {
      this._updateWorldTransform()
      batch.markDerived(index, DIRTY_WORLD_BOUNDS)
    }

    if (hasDirtySubtree || mustUpdate) {
      for (const child of this._cursor.children(false)) {
        this._processSubtree(child.index, mustUpdate, batch, processed, path)
      }
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
      return
    }

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
