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
 * Traverses top-down, skipping subtrees without transform changes.
 * Marks updated nodes with DIRTY_AABB for AABBSystem to process.
 */
@system
export class MatrixSystem extends SystemBase {
  public static readonly name = Systems.Matrix
  private _cursor: NodeCursor
  private _tempMatrix: mat2d = mat2d.create()

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, -1)
  }

  public process(dirtyMap: Map<number, number>) {
    if (dirtyMap.size === 0) return

    const processed = new Set<number>()

    for (const nodeIndex of dirtyMap.keys()) {
      if (!processed.has(nodeIndex)) {
        this._processNodeWithAncestors(
          nodeIndex,
          dirtyMap,
          processed,
          new Set()
        )
      }
    }
  }

  private _processNodeWithAncestors(
    index: number,
    dirtyMap: Map<number, number>,
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
      dirtyMap.has(parent.index) &&
      !processed.has(parent.index)
    ) {
      this._processNodeWithAncestors(parent.index, dirtyMap, processed, path)
    }

    path.delete(index)
    const parentDirty = parent !== null && processed.has(parent.index)
    this._processSubtree(index, parentDirty, dirtyMap, processed, new Set())
  }

  private _processSubtree(
    index: number,
    parentDirty: boolean,
    dirtyMap: Map<number, number>,
    processed: Set<number>,
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
    processed.add(index)

    const mustUpdate = hasDirtyTransform || parentDirty

    if (mustUpdate) {
      this._updateWorldTransform()
      const currentFlags = dirtyMap.get(index) || 0
      dirtyMap.set(index, currentFlags | DIRTY_AABB)
    }

    if (hasDirtySubtree || mustUpdate) {
      for (const child of this._cursor.children(false)) {
        this._processSubtree(child.index, mustUpdate, dirtyMap, processed, path)
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

    const p = parent.worldTransform
    const c = this._cursor.transform

    const a = p[0] * c[0] + p[2] * c[1]
    const b = p[1] * c[0] + p[3] * c[1]
    const cVal = p[0] * c[2] + p[2] * c[3]
    const d = p[1] * c[2] + p[3] * c[3]

    const originX = parent.width / 2
    const originY = parent.height / 2
    const parentCenterX = p[4] + originX
    const parentCenterY = p[5] + originY
    const xWithOrigin = c[4] - originX
    const yWithOrigin = c[5] - originY
    const offsetX = p[0] * xWithOrigin + p[2] * yWithOrigin
    const offsetY = p[1] * xWithOrigin + p[3] * yWithOrigin

    this._tempMatrix[0] = a
    this._tempMatrix[1] = b
    this._tempMatrix[2] = cVal
    this._tempMatrix[3] = d
    this._tempMatrix[4] = parentCenterX + offsetX
    this._tempMatrix[5] = parentCenterY + offsetY

    TransformOps.setWorldMatrix(
      this._sceneGraph,
      this._cursor.index,
      this._tempMatrix
    )
  }
}
