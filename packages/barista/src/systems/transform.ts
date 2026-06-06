import {
  type SceneGraph,
  applyDistributiveScale,
  DIRTY_AABB,
  DIRTY_TRANSFORM,
  NodeCursor,
  NULL_INDEX,
} from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'

import { getTransactionManager } from '../transactions/transactionRegistry'
import { system, SystemBase, Systems } from './systems'

import type { IDType } from '@latte-js/bean'
import type { MutationPolicyMap } from '../transactions/mutationPolicy'

const idsFromFirstArg = (args: readonly unknown[]) => args[0] as IDType[]

const transformMutationPolicies: MutationPolicyMap = {
  moveTo: {
    kind: 'atomic',
    label: 'Move Layer',
    ids: idsFromFirstArg,
  },
  moveBy: {
    kind: 'atomic',
    label: 'Move Layer',
    ids: idsFromFirstArg,
  },
  transformAround: {
    kind: 'atomic',
    label: 'Transform Layer',
    ids: idsFromFirstArg,
  },
}

@system({ mutations: transformMutationPolicies })
export class TransformSystem extends SystemBase {
  public static readonly name = Systems.Transform
  private _cursor: NodeCursor
  private _transactions = getTransactionManager(this._sceneGraph)

  constructor(sceneGraph: SceneGraph) {
    super(sceneGraph)
    this._cursor = new NodeCursor(this._sceneGraph, 0)
  }

  /**
   * Move a node to a target world position.
   * Computes the world-space delta, then converts to local-space delta
   * via the parent's inverse world transform.
   */
  private _moveTo(id: IDType, worldPos: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)

    const parent = this._cursor.parent

    if (parent === null) {
      const deltaX = worldPos[0] - this._cursor.x
      const deltaY = worldPos[1] - this._cursor.y
      this._cursor.x += deltaX
      this._cursor.y += deltaY
    } else {
      const currentWorldMatrix = this._cursor.worldTransform
      const deltaX = worldPos[0] - currentWorldMatrix[4]
      const deltaY = worldPos[1] - currentWorldMatrix[5]
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
    ids.forEach(id => this._moveTo(id, worldPos))
  }

  /**
   * Move a node by a world-space delta.
   * With an active transaction: delta is absolute from the transaction's
   * captured world position. Without one, delta is incremental.
   */
  private _moveBy(id: IDType, worldDelta: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)

    const snapshot = this._transactions.getSnapshot(id)
    const baseWorldX =
      snapshot && this._sceneGraph.parent[index] === NULL_INDEX
        ? snapshot.x
        : (snapshot?.worldTransform[4] ?? this._cursor.worldTransform[4])
    const baseWorldY =
      snapshot && this._sceneGraph.parent[index] === NULL_INDEX
        ? snapshot.y
        : (snapshot?.worldTransform[5] ?? this._cursor.worldTransform[5])

    this._moveTo(
      id,
      vec2.fromValues(baseWorldX + worldDelta[0], baseWorldY + worldDelta[1])
    )
  }

  public moveBy(ids: IDType[], worldDelta: vec2) {
    ids.forEach(id => this._moveBy(id, worldDelta))
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
   * 4. Convert to local: L_new = parentWorld^-1 * W_new
   */
  private _transformAround(id: IDType, matrixPayload: mat2d, pivot: vec2) {
    const index = this._sceneGraph.getIndex(id)
    this._cursor.to(index)

    const currentWorld = mat2d.clone(this._cursor.worldTransform as mat2d)

    const m0 = matrixPayload[0]
    const m1 = matrixPayload[1]
    const m2 = matrixPayload[2]
    const m3 = matrixPayload[3]
    const m4 = matrixPayload[4]
    const m5 = matrixPayload[5]
    const px = pivot[0]
    const py = pivot[1]

    const txStep = px - (m0 * px + m2 * py) + m4
    const tyStep = py - (m1 * px + m3 * py) + m5

    const w0 = currentWorld[0]
    const w1 = currentWorld[1]
    const w2 = currentWorld[2]
    const w3 = currentWorld[3]
    const w4 = currentWorld[4]
    const w5 = currentWorld[5]

    const newWorld = mat2d.fromValues(
      m0 * w0 + m2 * w1,
      m1 * w0 + m3 * w1,
      m0 * w2 + m2 * w3,
      m1 * w2 + m3 * w3,
      m0 * w4 + m2 * w5 + txStep,
      m1 * w4 + m3 * w5 + tyStep
    )

    const parent = this._cursor.parent
    let newLocal: mat2d

    if (parent === null) {
      newLocal = newWorld
    } else {
      const parentWorld = parent.worldTransform as mat2d
      const parentWorldInv = mat2d.invert(mat2d.create(), parentWorld)
      newLocal =
        parentWorldInv === null
          ? newWorld
          : mat2d.multiply(mat2d.create(), parentWorldInv, newWorld)
    }

    this._cursor.transform = newLocal
    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
  }

  public transformAround(ids: IDType[], matrixPayload: mat2d, pivot: vec2) {
    ids.forEach(id => this._transformAround(id, matrixPayload, pivot))
  }

  private _resize(id: IDType, width: number, height: number) {
    const index = this._sceneGraph.getIndex(id)
    const snapData = this._transactions.getSnapshot(id)
    this._resizeByIndex(index, width, height, snapData)
  }

  private _resizeByIndex(
    index: number,
    width: number,
    height: number,
    snapData?: { width: number; height: number }
  ) {
    this._cursor.to(index)

    const oldWidth = snapData ? snapData.width : this._cursor.width
    const oldHeight = snapData ? snapData.height : this._cursor.height

    if (oldWidth === 0 || oldHeight === 0) {
      this._cursor.width = width
      this._cursor.height = height
      this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)
      return
    }

    const scaleX = width / oldWidth
    const scaleY = height / oldHeight

    this._cursor.width = width
    this._cursor.height = height
    this._sceneGraph.markDirty(index, DIRTY_TRANSFORM | DIRTY_AABB)

    const parentOldWorld = mat2d.create()
    const parentNewWorld = mat2d.create()
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
