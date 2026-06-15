import {
  DIRTY_LOCAL_MATRIX,
  DIRTY_WORLD_BOUNDS,
  MAX_NODES,
  NULL_INDEX,
} from '@latte-js/espresso'
import { mat2d, vec2 } from 'gl-matrix'

import { getTransactionManager } from '../transactions/transactionRegistry'
import { System, SystemBase, Systems } from './systems'

import type { IDType } from '@latte-js/bean'
import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'
import { TransactionLabel } from '../transactions/transactionLabels'

const idsFromFirstArg = (args: readonly unknown[]) => args[0] as IDType[]
const EPSILON = 1e-6

interface TransformTarget {
  readonly id: IDType
  readonly index: number
}

const transformMutationPolicies: MutationPolicyMap = {
  moveTo: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.MoveLayer,
    ids: idsFromFirstArg,
  },
  moveBy: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.MoveLayer,
    ids: idsFromFirstArg,
  },
  transformAround: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.TransformLayer,
    ids: idsFromFirstArg,
  },
  resize: {
    kind: MutationPolicyKind.Atomic,
    label: TransactionLabel.ResizeLayer,
    ids: idsFromFirstArg,
  },
}

@System({ mutations: transformMutationPolicies })
export class TransformSystem extends SystemBase {
  public static readonly name = Systems.Transform

  private get _cursor() {
    return this._getCursor('transform', 0)
  }

  private get _scratchCursor() {
    return this._getCursor('transform:scratch', 0)
  }

  private get _transactions() {
    return getTransactionManager(this._sceneGraph, this._currentSessionId)
  }

  private _getSnapshot(id: IDType) {
    return this._transactions.getSnapshot(id)
  }

  private _prepareTargets(ids: readonly IDType[], source: string) {
    const targets = this._resolveTransformTargets(ids, source)
    this._transactions.capture(targets.map(target => target.id))
    return targets
  }

  private _resolveTransformTargets(
    ids: readonly IDType[],
    source: string
  ): TransformTarget[] {
    const seenIds = new Set<IDType>()
    const targets: TransformTarget[] = []

    for (const id of ids) {
      if (seenIds.has(id)) {
        continue
      }
      seenIds.add(id)

      const index = this._sceneGraph.getIndex(id)
      if (index === NULL_INDEX) {
        throw new Error(`[TransformSystem] Node not found for ${source}: ${id}`)
      }

      targets.push({ id, index })
    }

    const targetIndexes = new Set(targets.map(target => target.index))
    return targets.filter(
      target => !this._hasSelectedAncestor(target.index, targetIndexes)
    )
  }

  private _hasSelectedAncestor(index: number, targetIndexes: Set<number>) {
    let current = this._sceneGraph.parent[index]
    let depth = 0

    while (current !== NULL_INDEX) {
      if (targetIndexes.has(current)) {
        return true
      }
      if (depth++ > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${current}`)
      }
      current = this._sceneGraph.parent[current]
    }

    return false
  }

  private _getLocalMatrix(index: number, out: mat2d = mat2d.create()): mat2d {
    this._scratchCursor.to(index)
    return mat2d.copy(out, this._scratchCursor.transform as mat2d)
  }

  private _getBaseLocalMatrix(
    index: number,
    out: mat2d = mat2d.create()
  ): mat2d {
    const id = this._sceneGraph.getUUID(index)
    const snapshot = id ? this._getSnapshot(id) : undefined
    if (snapshot) {
      return mat2d.copy(out, snapshot.transform as mat2d)
    }
    return this._getLocalMatrix(index, out)
  }

  private _getBaseWorldMatrix(
    index: number,
    out: mat2d = mat2d.create()
  ): mat2d {
    return this._computeBaseWorldMatrix(index, out)
  }

  private _getBaseSize(id: IDType, index: number) {
    const snapshot = this._getSnapshot(id)
    if (snapshot) {
      return {
        width: snapshot.width,
        height: snapshot.height,
      }
    }

    this._scratchCursor.to(index)
    return {
      width: this._scratchCursor.width,
      height: this._scratchCursor.height,
    }
  }

  private _getParentWorld(index: number, out: mat2d = mat2d.create()) {
    const parentIndex = this._sceneGraph.parent[index]
    if (parentIndex === NULL_INDEX) {
      return mat2d.identity(out)
    }
    return this._computeBaseWorldMatrix(parentIndex, out)
  }

  private _computeBaseWorldMatrix(index: number, out: mat2d = mat2d.create()) {
    const chain: number[] = []
    const visited = new Set<number>()
    let current = index

    while (current !== NULL_INDEX) {
      if (visited.has(current) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${current}`)
      }
      visited.add(current)
      chain.push(current)
      current = this._sceneGraph.parent[current]
    }

    mat2d.identity(out)
    const local = mat2d.create()
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      this._getBaseLocalMatrix(chain[i], local)
      mat2d.multiply(out, out, local)
    }

    return out
  }

  private _worldToLocal(
    world: mat2d,
    parentWorld: mat2d,
    out: mat2d = mat2d.create()
  ) {
    const parentWorldInv = mat2d.invert(mat2d.create(), parentWorld)
    if (parentWorldInv === null) {
      throw new Error(
        '[TransformSystem] Cannot convert world transform through a non-invertible parent matrix'
      )
    }
    return mat2d.multiply(out, parentWorldInv, world)
  }

  private _buildPivotedWorldStep(matrixPayload: mat2d, pivot: vec2) {
    const step = mat2d.create()
    mat2d.translate(step, step, pivot)
    mat2d.multiply(step, step, matrixPayload)
    mat2d.translate(step, step, [-pivot[0], -pivot[1]])
    return step
  }

  private _markTransformDirty(index: number) {
    this._sceneGraph.markDirty(index, DIRTY_LOCAL_MATRIX | DIRTY_WORLD_BOUNDS)
  }

  private _applyTargetWorldMatrix(
    index: number,
    targetWorld: mat2d,
    parentWorld?: mat2d
  ) {
    this._cursor.to(index)
    const local = this._worldToLocal(
      targetWorld,
      parentWorld ?? this._getParentWorld(index)
    )
    this._cursor.transform = local
    this._markTransformDirty(index)
  }

  private _moveTo(target: TransformTarget, worldPos: vec2) {
    const targetWorld = this._getBaseWorldMatrix(target.index)
    targetWorld[4] = worldPos[0]
    targetWorld[5] = worldPos[1]
    this._applyTargetWorldMatrix(target.index, targetWorld)
  }

  public moveTo(ids: IDType[], worldPos: vec2) {
    this._assertFiniteVec2(worldPos, 'moveTo')
    const targets = this._prepareTargets(ids, 'moveTo')
    targets.forEach(target => this._moveTo(target, worldPos))
  }

  /**
   * Move a node by a world-space delta.
   * With an active transaction: delta is absolute from the transaction's
   * captured world position. Without one, delta is incremental.
   */
  private _moveBy(target: TransformTarget, worldDelta: vec2) {
    const baseWorld = this._getBaseWorldMatrix(target.index)

    this._moveTo(
      target,
      vec2.fromValues(
        baseWorld[4] + worldDelta[0],
        baseWorld[5] + worldDelta[1]
      )
    )
  }

  public moveBy(ids: IDType[], worldDelta: vec2) {
    this._assertFiniteVec2(worldDelta, 'moveBy')
    const targets = this._prepareTargets(ids, 'moveBy')
    targets.forEach(target => this._moveBy(target, worldDelta))
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
  private _transformAround(
    target: TransformTarget,
    matrixPayload: mat2d,
    pivot: vec2
  ) {
    const currentWorld = this._getBaseWorldMatrix(target.index)
    const worldStep = this._buildPivotedWorldStep(matrixPayload, pivot)
    const newWorld = mat2d.multiply(mat2d.create(), worldStep, currentWorld)
    this._applyTargetWorldMatrix(target.index, newWorld)
  }

  public transformAround(ids: IDType[], matrixPayload: mat2d, pivot: vec2) {
    this._assertFiniteMatrix(matrixPayload, 'transformAround matrix')
    this._assertFiniteVec2(pivot, 'transformAround pivot')
    const targets = this._prepareTargets(ids, 'transformAround')
    targets.forEach(target =>
      this._transformAround(target, matrixPayload, pivot)
    )
  }

  private _resize(target: TransformTarget, width: number, height: number) {
    this._resizeByIndex(target.id, target.index, width, height)
  }

  private _resizeByIndex(
    id: IDType,
    index: number,
    width: number,
    height: number
  ) {
    const baseSize = this._getBaseSize(id, index)

    if (baseSize.width === 0 || baseSize.height === 0) {
      this._cursor.to(index)
      this._cursor.width = width
      this._cursor.height = height
      this._cursor.transform = this._getBaseLocalMatrix(index)
      this._markTransformDirty(index)
      return
    }

    const scaleX = width / baseSize.width
    const scaleY = height / baseSize.height
    const baseWorld = this._getBaseWorldMatrix(index)
    const baseWorldInv = mat2d.invert(mat2d.create(), baseWorld)

    if (baseWorldInv === null) {
      throw new Error(
        `[TransformSystem] Cannot resize through a non-invertible world matrix: ${id}`
      )
    }

    const scaleInNodeWorld = mat2d.fromScaling(mat2d.create(), [scaleX, scaleY])
    const worldStep = mat2d.create()
    mat2d.multiply(worldStep, baseWorld, scaleInNodeWorld)
    mat2d.multiply(worldStep, worldStep, baseWorldInv)

    this._cursor.to(index)
    this._cursor.width = width
    this._cursor.height = height
    this._cursor.transform = this._getBaseLocalMatrix(index)
    this._markTransformDirty(index)

    this._transactions.capture(this._collectDescendantIds(index))
    this._applyWorldStepToDescendants(index, baseWorld, worldStep)
  }

  private _collectDescendantIds(index: number): IDType[] {
    const ids: IDType[] = []
    const stack = [this._sceneGraph.firstChild[index]]
    const visited = new Set<number>()

    while (stack.length > 0) {
      const current = stack.pop()!
      if (current === NULL_INDEX) {
        continue
      }
      if (visited.has(current) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${current}`)
      }

      visited.add(current)
      const id = this._sceneGraph.getUUID(current)
      if (id) {
        ids.push(id)
      }

      let child = this._sceneGraph.firstChild[current]
      while (child !== NULL_INDEX) {
        stack.push(child)
        child = this._sceneGraph.nextSibling[child]
      }
    }

    return ids
  }

  private _applyWorldStepToDescendants(
    rootIndex: number,
    rootTargetWorld: mat2d,
    worldStep: mat2d
  ) {
    const stack: Array<{
      index: number
      parentTargetWorld: mat2d
    }> = []

    let child = this._sceneGraph.firstChild[rootIndex]
    while (child !== NULL_INDEX) {
      stack.push({
        index: child,
        parentTargetWorld: mat2d.clone(rootTargetWorld),
      })
      child = this._sceneGraph.nextSibling[child]
    }

    const visited = new Set<number>()
    while (stack.length > 0) {
      const item = stack.pop()!
      if (visited.has(item.index) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${item.index}`)
      }
      visited.add(item.index)

      const id = this._sceneGraph.getUUID(item.index)
      if (!id) {
        const baseLocal = this._getBaseLocalMatrix(item.index)
        this._pushChildrenForWorldStep(
          stack,
          item.index,
          mat2d.multiply(mat2d.create(), item.parentTargetWorld, baseLocal)
        )
        continue
      }

      const baseWorld = this._getBaseWorldMatrix(item.index)
      const targetWorld = mat2d.multiply(mat2d.create(), worldStep, baseWorld)
      const targetLocal = this._worldToLocal(
        targetWorld,
        item.parentTargetWorld
      )
      const finalLocal = this._applyWorldScaleToSize(
        id,
        item.index,
        baseWorld,
        targetWorld,
        targetLocal
      )
      const nextParentTargetWorld = mat2d.multiply(
        mat2d.create(),
        item.parentTargetWorld,
        finalLocal
      )

      this._cursor.to(item.index)
      this._cursor.transform = finalLocal
      this._markTransformDirty(item.index)

      this._pushChildrenForWorldStep(stack, item.index, nextParentTargetWorld)
    }
  }

  private _pushChildrenForWorldStep(
    stack: Array<{
      index: number
      parentTargetWorld: mat2d
    }>,
    index: number,
    parentTargetWorld: mat2d
  ) {
    let nextChild = this._sceneGraph.firstChild[index]
    while (nextChild !== NULL_INDEX) {
      stack.push({
        index: nextChild,
        parentTargetWorld: mat2d.clone(parentTargetWorld),
      })
      nextChild = this._sceneGraph.nextSibling[nextChild]
    }
  }

  private _applyWorldScaleToSize(
    id: IDType,
    index: number,
    baseWorld: mat2d,
    targetWorld: mat2d,
    targetLocal: mat2d
  ): mat2d {
    const baseSize = this._getBaseSize(id, index)
    const worldScaleX = this._getAxisScale(baseWorld, targetWorld, 0)
    const worldScaleY = this._getAxisScale(baseWorld, targetWorld, 1)
    const finalLocal = mat2d.clone(targetLocal)

    this._cursor.to(index)
    this._cursor.width = baseSize.width * worldScaleX
    this._cursor.height = baseSize.height * worldScaleY

    if (Math.abs(worldScaleX) > EPSILON) {
      finalLocal[0] /= worldScaleX
      finalLocal[1] /= worldScaleX
    }
    if (Math.abs(worldScaleY) > EPSILON) {
      finalLocal[2] /= worldScaleY
      finalLocal[3] /= worldScaleY
    }

    return finalLocal
  }

  private _getAxisScale(baseWorld: mat2d, targetWorld: mat2d, axis: 0 | 1) {
    const baseX = axis === 0 ? baseWorld[0] : baseWorld[2]
    const baseY = axis === 0 ? baseWorld[1] : baseWorld[3]
    const targetX = axis === 0 ? targetWorld[0] : targetWorld[2]
    const targetY = axis === 0 ? targetWorld[1] : targetWorld[3]
    const baseLength = Math.hypot(baseX, baseY)
    const targetLength = Math.hypot(targetX, targetY)
    return baseLength > EPSILON ? targetLength / baseLength : 1
  }

  public resize(ids: IDType[], width: number, height: number) {
    this._assertValidSize(width, height)
    const targets = this._prepareTargets(ids, 'resize')
    targets.forEach(target => this._resize(target, width, height))
  }

  private _assertFiniteVec2(value: vec2, source: string) {
    if (Number.isFinite(value[0]) && Number.isFinite(value[1])) {
      return
    }
    throw new Error(`[TransformSystem] Invalid ${source} vector`)
  }

  private _assertFiniteMatrix(value: mat2d, source: string) {
    for (let i = 0; i < 6; i += 1) {
      if (!Number.isFinite(value[i])) {
        throw new Error(`[TransformSystem] Invalid ${source}`)
      }
    }
  }

  private _assertValidSize(width: number, height: number) {
    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width >= 0 &&
      height >= 0
    ) {
      return
    }

    throw new Error('[TransformSystem] Invalid resize dimensions')
  }
}
