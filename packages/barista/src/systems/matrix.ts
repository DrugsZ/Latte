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
  private _tempMatrix = mat2d.create()

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
      const p = parent.worldTransform
      const c = this._cursor.transform

      // Manually multiply to separate rotation/scale and translation
      // This ensures clearer logic and avoids potential issues with standard matrix multiplication
      // if we ever need custom handling for position vs rotation.

      // 1. Rotation/Scale part (2x2 matrix multiplication)
      // | a b |   | a' b' |
      // | c d | * | c' d' |
      const a = p[0] * c[0] + p[2] * c[1]
      const b = p[1] * c[0] + p[3] * c[1]
      const c_val = p[0] * c[2] + p[2] * c[3]
      const d = p[1] * c[2] + p[3] * c[3]

      // 2. Translation part
      // Apply parent's transform (rotation/scale) to child's local position, then add parent's position
      // The child's position (c[4], c[5]) is relative to the parent's center (originX, originY).
      // We first convert it to be relative to the parent's top-left corner (standard local space),
      // then apply the parent's world matrix.

      const originX = parent.width / 2
      const originY = parent.height / 2

      // 1. Calculate Parent Center in World Space
      // The p[4], p[5] already represents the translation.
      // Since we rotate around the center, we simply add the center offset to the translation
      // without applying the rotation matrix to the center offset itself again.
      const parentCenterX = p[4] + originX
      const parentCenterY = p[5] + originY

      // 2. Calculate Child Offset Vector (rotated/scaled by Parent)
      // Offset_world = Parent_Rotation_Scale * Child_Translation_Local
      // Note: c[4], c[5] are treated as offsets relative to parent center
      const xWithOrigin = c[4] - originX
      const yWithOrigin = c[5] - originY
      const offsetX = p[0] * xWithOrigin + p[2] * yWithOrigin
      const offsetY = p[1] * xWithOrigin + p[3] * yWithOrigin

      // 3. Final World Position = Parent Center World + Rotated Offset
      const tx = parentCenterX + offsetX
      const ty = parentCenterY + offsetY

      this._tempMatrix[0] = a
      this._tempMatrix[1] = b
      this._tempMatrix[2] = c_val
      this._tempMatrix[3] = d
      this._tempMatrix[4] = tx
      this._tempMatrix[5] = ty
      this._cursor.worldTransform = this._tempMatrix
    }
  }
}
