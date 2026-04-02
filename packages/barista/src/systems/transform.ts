import {
  type SceneGraph,
  applyDistributiveScale,
  DIRTY_AABB,
  DIRTY_TRANSFORM,
  NodeCursor,
  NULL_INDEX,
} from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'

import { system, SystemBase, Systems } from './systems'

import type { IDType } from '@latte-js/bean'

type ISnapshot = Float32Array

// Snapshot layout:
// [0] x, [1] y, [2] width, [3] height,
// [4..9] localTransform (mat2d),
// [10..15] worldTransform (mat2d)
const SNAP_X = 0
const SNAP_Y = 1
const SNAP_W = 2
const SNAP_H = 3
const SNAP_WORLD_TX = 14
const SNAP_WORLD_TY = 15

@system
export class TransformSystem extends SystemBase {
  public static readonly name = Systems.Transform
  private _cursor: NodeCursor
  private _snapshots: Map<IDType, ISnapshot> = new Map()

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, 0)
  }

  private _createSnapshot(index: number) {
    this._cursor.to(index)
    const { x, y, width, height, transform, worldTransform, id } = this._cursor
    if (id === null) return
    const snapshot = new Float32Array([
      x,
      y,
      width,
      height,
      ...transform,
      ...worldTransform,
    ])
    this._snapshots.set(id, snapshot)
  }

  private _createSnapshots(ids: IDType[]) {
    this._snapshots.clear()
    ids.forEach(id => {
      const index = this._sceneGraph.getIndex(id)
      this._createSnapshot(index)
    })
  }

  public startSession(ids: IDType[]) {
    this._snapshots.clear()
    this._createSnapshots(ids)
  }

  public endSession() {
    this._snapshots.clear()
  }

  /**
   * Move a node to a target world position.
   * Computes the world-space delta, then converts to local-space delta
   * via the parent's inverse world transform.
   */
  private _moveTo(id: IDType, worldPos: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)

    // 1. Get current world position
    const currentWorldMatrix = this._cursor.worldTransform
    const currentWorldX = currentWorldMatrix[4]
    const currentWorldY = currentWorldMatrix[5]

    // 2. Calculate world delta
    const deltaX = worldPos[0] - currentWorldX
    const deltaY = worldPos[1] - currentWorldY

    // 3. Convert world delta to local delta
    const parent = this._cursor.parent

    if (parent === null) {
      this._cursor.x += deltaX
      this._cursor.y += deltaY
    } else {
      const p = parent.worldTransform
      const a = p[0]
      const b = p[1]
      const c = p[2]
      const d = p[3]
      const det = a * d - b * c

      if (Math.abs(det) < 1e-6) {
        this._cursor.x += deltaX
        this._cursor.y += deltaY
      } else {
        const localDeltaX = (d * deltaX - c * deltaY) / det
        const localDeltaY = (-b * deltaX + a * deltaY) / det
        this._cursor.x += localDeltaX
        this._cursor.y += localDeltaY
      }
    }

    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public moveTo(ids: IDType[], worldPos: vec2) {
    ids.forEach(i => this._moveTo(i, worldPos))
  }

  /**
   * Move a node by a world-space delta.
   * With an active session: delta is absolute from the snapshot's world position.
   * Without a session: delta is incremental from the current world position.
   */
  private _moveBy(id: IDType, worldDelta: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)
    const snapData = this._snapshots.get(id)

    // Get base world position
    let baseWorldX: number, baseWorldY: number
    if (snapData) {
      baseWorldX = snapData[SNAP_WORLD_TX]
      baseWorldY = snapData[SNAP_WORLD_TY]
    } else {
      const worldMat = this._cursor.worldTransform
      baseWorldX = worldMat[4]
      baseWorldY = worldMat[5]
    }

    // Target world position = base + delta
    this._moveTo(
      id,
      vec2.fromValues(baseWorldX + worldDelta[0], baseWorldY + worldDelta[1])
    )
  }

  public moveBy(ids: IDType[], worldDelta: vec2) {
    ids.forEach(i => this._moveBy(i, worldDelta))
  }

  /**
   * Apply a transformation matrix around a world-space pivot point.
   *
   * All parameters are in world coordinates:
   * - matrixPayload: the rotation/scale matrix to apply in world space
   * - pivot: the pivot point in world space
   *
   * Algorithm:
   * 1. Get current world transform W_old
   * 2. Construct world-space step: transformStep = T(pivot) * M * T(-pivot)
   * 3. Compute new world: W_new = transformStep * W_old
   * 4. Convert to local: L_new = parentWorld^(-1) * W_new
   *
   * This unified approach works identically for:
   * - Single rotated nodes: parent inverse cancels node rotation for axis-aligned operations
   * - Temporary groups: parent inverse is identity, matrix applies directly
   * - Deeply nested nodes: full world→local conversion handles any hierarchy
   */
  private _transformAround(id: IDType, matrixPayload: mat2d, pivot: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)

    // 1. Get current world transform
    const currentWorld = mat2d.clone(this._cursor.worldTransform as mat2d)

    // 2. Construct world-space transform step: T(pivot) * M * T(-pivot)
    const m0 = matrixPayload[0]
    const m1 = matrixPayload[1]
    const m2 = matrixPayload[2]
    const m3 = matrixPayload[3]
    const m4 = matrixPayload[4]
    const m5 = matrixPayload[5]
    const px = pivot[0]
    const py = pivot[1]

    const tx_step = px - (m0 * px + m2 * py) + m4
    const ty_step = py - (m1 * px + m3 * py) + m5

    // 3. W_new = transformStep * W_old
    const w0 = currentWorld[0],
      w1 = currentWorld[1]
    const w2 = currentWorld[2],
      w3 = currentWorld[3]
    const w4 = currentWorld[4],
      w5 = currentWorld[5]

    const newWorld = mat2d.fromValues(
      m0 * w0 + m2 * w1,
      m1 * w0 + m3 * w1,
      m0 * w2 + m2 * w3,
      m1 * w2 + m3 * w3,
      m0 * w4 + m2 * w5 + tx_step,
      m1 * w4 + m3 * w5 + ty_step
    )

    // 4. Convert to local: L_new = parentWorld^(-1) * W_new
    const parent = this._cursor.parent
    let newLocal: mat2d

    if (parent === null) {
      // No parent: world = local
      newLocal = newWorld
    } else {
      const parentWorld = parent.worldTransform as mat2d
      const parentWorldInv = mat2d.invert(mat2d.create(), parentWorld)
      if (parentWorldInv === null) {
        // Degenerate parent matrix: use world as local (approximate)
        newLocal = newWorld
      } else {
        newLocal = mat2d.multiply(mat2d.create(), parentWorldInv, newWorld)
      }
    }

    this._cursor.transform = newLocal

    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public transformAround(ids: IDType[], matrixPayload: mat2d, pivot: vec2) {
    ids.forEach(i => this._transformAround(i, matrixPayload, pivot))
  }

  private _resize(id: IDType, width: number, height: number) {
    const index = this._sceneGraph.getIndex(id)
    const snapData = this._snapshots.get(id)
    this._resizeByIndex(index, width, height, snapData)
  }

  private _resizeByIndex(
    index: number,
    width: number,
    height: number,
    snapData?: ISnapshot
  ) {
    this._cursor.to(index)

    const oldWidth = snapData ? snapData[2] : this._cursor.width
    const oldHeight = snapData ? snapData[3] : this._cursor.height

    // Handle zero-size case: just set new size directly
    if (oldWidth === 0 || oldHeight === 0) {
      this._cursor.width = width
      this._cursor.height = height
      this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
      return
    }

    // Calculate scale factors at the top level
    const scaleX = width / oldWidth
    const scaleY = height / oldHeight

    // For the root node being resized, we don't apply stretch to its own transform
    // (the root node's rotation should be preserved, only its size changes)
    // But we do need to update the root's size directly
    this._cursor.width = width
    this._cursor.height = height
    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)

    // Recursively apply stretch to all children
    // The parent's local space is deformed by (scaleX, scaleY)
    // We use the "World Space Mutation" algorithm.
    // Parent Old World = Identity (relative to itself)
    // Parent New World = Identity (relative to itself, because we kept its transform normalized)
    // Root Scale = The deformation we want to apply
    const parentOldWorld = mat2d.create() // Identity
    const parentNewWorld = mat2d.create() // Identity
    const rootScale = mat2d.fromScaling(mat2d.create(), [scaleX, scaleY])

    let child = this._sceneGraph.firstChild[index]
    while (child !== NULL_INDEX) {
      applyDistributiveScale(
        this._sceneGraph,
        this._cursor,
        child,
        parentOldWorld,
        parentNewWorld,
        rootScale
      )
      child = this._sceneGraph.nextSibling[child]
    }
  }

  public resize(ids: IDType[], width: number, height: number) {
    ids.forEach(id => this._resize(id, width, height))
  }
}
