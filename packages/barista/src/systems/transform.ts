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
    const { x, y, width, height, transform, id } = this._cursor
    if (id === null) return
    const snapshot = new Float32Array([x, y, width, height, ...transform])
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
      // No parent, world delta is local delta
      this._cursor.x += deltaX
      this._cursor.y += deltaY
    } else {
      const p = parent.worldTransform
      // Parent rotation/scale matrix components
      const a = p[0]
      const b = p[1]
      const c = p[2]
      const d = p[3]

      // Determine determinat to check for invertibility
      const det = a * d - b * c

      if (Math.abs(det) < 1e-6) {
        // Fallback for degenerate matrix: apply delta directly (approximate)
        this._cursor.x += deltaX
        this._cursor.y += deltaY
      } else {
        // Inverse rotation/scale:
        // | x | = 1/det * | d  -c | * | dx |
        // | y |           | -b  a |   | dy |
        const localDeltaX = (d * deltaX - c * deltaY) / det
        const localDeltaY = (-b * deltaX + a * deltaY) / det

        this._cursor.x += localDeltaX
        this._cursor.y += localDeltaY
      }
    }

    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public moveTo(ids: IDType[], delta: vec2) {
    ids.forEach(i => this._moveTo(i, delta))
  }

  private _moveBy(id: IDType, point: vec2) {
    const snapData = this._snapshots.get(id)
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)
    const base = snapData
      ? [snapData[7], snapData[8]]
      : [this._cursor.x, this._cursor.y]
    vec2.add(base, base, point)
    this._cursor.x = base[0]
    this._cursor.y = base[1]
    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public moveBy(ids: IDType[], point: vec2) {
    ids.forEach(i => this._moveBy(i, point))
  }

  private _transformAround(id: IDType, matrixPayload: mat2d, pivot: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)
    const localMat = this._cursor.transform

    // 1. Calculate the rotation/scale part separately
    // transformStep = matrixPayload (since pivot only affects translation in the end result for rotation part)
    // localMatRot = transformStepRot * localMatRot
    const a = matrixPayload[0] * localMat[0] + matrixPayload[2] * localMat[1]
    const b = matrixPayload[1] * localMat[0] + matrixPayload[3] * localMat[1]
    const c = matrixPayload[0] * localMat[2] + matrixPayload[2] * localMat[3]
    const d = matrixPayload[1] * localMat[2] + matrixPayload[3] * localMat[3]

    // 2. Calculate the translation part separately
    // The pivot point affects the translation.
    // NewPos = Matrix * (OldPos - Pivot) + Pivot
    // But since we are applying a delta matrix (matrixPayload) which is relative to the pivot:
    // We can imagine the operation as:
    // Translate(-pivot) -> Apply Matrix -> Translate(pivot)
    // For a point P: P' = M * (P - pivot) + pivot
    //                 = M * P - M * pivot + pivot
    //                 = M * P + (pivot - M * pivot)

    // The local matrix 'localMat' represents the transform of the object.
    // We are applying the transform step "before" or "after"?
    // "transformAround" usually implies modifying the current transform by rotating around a pivot point.
    // If we rotate a node around a pivot, its position changes, and its rotation changes.

    // Let's stick to the previous logic but implemented manually to separate components.
    // The previous logic was:
    // transformStep = Translate(pivot) * Matrix * Translate(-pivot)
    // localMat = transformStep * localMat

    // Let's construct transformStep manually first
    // transformStep =
    // [ m0 m2  px - (m0*px + m2*py) ]
    // [ m1 m3  py - (m1*px + m3*py) ]
    // [ 0  0   1                    ]

    const m0 = matrixPayload[0]
    const m1 = matrixPayload[1]
    const m2 = matrixPayload[2]
    const m3 = matrixPayload[3]
    const m4 = matrixPayload[4] // usually 0 for rotation/scale matrix
    const m5 = matrixPayload[5] // usually 0

    const px = pivot[0]
    const py = pivot[1]

    // The effective translation of the transformStep (M_new)
    // M_new = T(p) * M * T(-p)
    // The rotation part of M_new is just M (m0, m1, m2, m3)
    // The translation part:
    // tx_step = m0 * (-px) + m2 * (-py) + m4 + px
    // ty_step = m1 * (-px) + m3 * (-py) + m5 + py
    const tx_step = px - (m0 * px + m2 * py) + m4
    const ty_step = py - (m1 * px + m3 * py) + m5

    // Now multiply transformStep with localMat
    // localMat = transformStep * localMat
    // This looks wrong. "transformAround" generally means we apply a transformation in the parent space?
    // Or are we modifying the local transform itself?
    // If we use the tool logic `mat2d.multiply(localMat, transformStep, localMat)`
    // it implies `localMat = transformStep * localMat`.
    // This means transformStep is applied "after" the current local transform (in local space? No, matrix multiplication order matters).
    // If `NewLocal = Step * OldLocal`, then Step is applied in the parent frame.
    // Yes, we are rotating around a pivot in the parent frame (likely world frame or parent frame).

    // So we update the mix:
    // Rot/Scale part (as above):
    // NewRot = M_rot * OldRot

    // Pos part:
    // NewPos = M_step * OldPos
    // NewX = m0 * oldX + m2 * oldY + tx_step
    // NewY = m1 * oldX + m3 * oldY + ty_step

    const oldX = localMat[4]
    const oldY = localMat[5]

    const newX = m0 * oldX + m2 * oldY + tx_step
    const newY = m1 * oldX + m3 * oldY + ty_step

    localMat[0] = a
    localMat[1] = b
    localMat[2] = c
    localMat[3] = d
    localMat[4] = newX
    localMat[5] = newY

    this._cursor.transform = localMat

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
