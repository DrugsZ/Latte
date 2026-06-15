import {
  NodeCursor,
  NULL_INDEX,
  PropId,
  type INodeLifecyclePayload,
  type INodeMutationRecord,
  type INodePlacement,
  type SceneGraph,
} from '@latte-js/espresso'

import {
  asArray,
  asBoolean,
  asCornerRadius,
  asMatrix,
  asNumber,
  asString,
} from './recordValue'

import type { IDType } from '@latte-js/bean'

const isPlacement = (value: unknown): value is INodePlacement =>
  typeof value === 'object' &&
  value !== null &&
  'parentId' in value &&
  'position' in value

const isLifecyclePayload = (value: unknown): value is INodeLifecyclePayload =>
  isPlacement(value) && 'index' in value && typeof value.index === 'number'

export class MutationRecordApplier {
  constructor(private readonly _sceneGraph: SceneGraph) {}

  public applyRecords(records: readonly INodeMutationRecord[]) {
    for (const record of records) {
      this.applyRecord(record)
    }
  }

  public applyRecord(record: INodeMutationRecord) {
    const index = this._sceneGraph.getIndex(record.id)
    const cursor = new NodeCursor(
      this._sceneGraph,
      index >= 0 ? index : record.index
    )
    const value = record.newValue

    switch (record.prop) {
      case PropId.X:
        cursor.x = asNumber(value)
        return
      case PropId.Y:
        cursor.y = asNumber(value)
        return
      case PropId.WIDTH:
        cursor.width = asNumber(value)
        return
      case PropId.HEIGHT:
        cursor.height = asNumber(value)
        return
      case PropId.NAME:
        cursor.name = asString(value)
        return
      case PropId.TRANSFORM:
        cursor.transform = asMatrix(value)
        return
      case PropId.WORLD_TRANSFORM:
        cursor.worldTransform = asMatrix(value)
        return
      case PropId.VISIBLE:
        cursor.visible = asBoolean(value)
        return
      case PropId.OPACITY:
        cursor.opacity = asNumber(value)
        return
      case PropId.FILLS:
        cursor.fills = asArray(value)
        return
      case PropId.STROKES:
        cursor.strokes = asArray(value)
        return
      case PropId.CORNER_RADIUS:
        cursor.cornerRadius = asCornerRadius(value)
        return
      case PropId.STROKE_WEIGHT:
        cursor.strokeWeight = asNumber(value)
        return
      case PropId.STROKE_ALIGN:
        cursor.strokeAlign = asString(value) as any
        return
      case PropId.STROKE_STYLE:
        cursor.strokeStyle = asString(value) as any
        return
      case PropId.STROKE_JOIN:
        cursor.strokeJoin = asString(value) as any
        return
      case PropId.DASH_CAP:
        cursor.dashCap = asString(value) as any
        return
      case PropId.LOCKED:
        cursor.locked = asBoolean(value)
        return
      case PropId.PARENT:
        this._applyParent(cursor, value)
        return
      case PropId.CREATE_SELF:
        this._applyLifecycle(record, value)
        return
      case PropId.REMOVE_SELF:
        this._applyLifecycle(record, value)
        return
      default:
        throw new Error(
          `[MutationRecordApplier] Unsupported history prop: ${String(record.prop)}`
        )
    }
  }

  public finalizeTombstones(records: readonly INodeMutationRecord[]) {
    for (const record of records) {
      this._finalizeLifecycleTombstone(record, record.oldValue)
      this._finalizeLifecycleTombstone(record, record.newValue)
    }
  }

  private _applyParent(cursor: NodeCursor, value: unknown) {
    const parentId = this._readParentId(value)
    const currentParent = cursor.parent
    if (parentId === null) {
      currentParent?.removeChild(cursor)
      return
    }

    const parentIndex = this._sceneGraph.getIndex(parentId)
    if (parentIndex < 0) {
      throw new Error(`[MutationRecordApplier] Parent not found: ${parentId}`)
    }
    const position = isPlacement(value)
      ? Number(value.position)
      : Number.MAX_SAFE_INTEGER
    this._sceneGraph.insertChildAt(parentIndex, cursor.index, position)
  }

  private _applyLifecycle(record: INodeMutationRecord, value: unknown) {
    if (value === null) {
      const index = this._sceneGraph.getIndex(record.id)
      if (index >= 0) {
        this._sceneGraph.deleteNode(index)
      }
      return
    }

    if (!isLifecyclePayload(value)) {
      throw new Error('[MutationRecordApplier] Expected node lifecycle payload')
    }

    const tombstoneIndex = this._sceneGraph.getTombstoneIndex(record.id)
    const index = tombstoneIndex >= 0 ? tombstoneIndex : value.index
    const parentIndex =
      value.parentId === null
        ? NULL_INDEX
        : this._sceneGraph.getIndex(value.parentId)

    if (value.parentId !== null && parentIndex < 0) {
      throw new Error(
        `[MutationRecordApplier] Parent not found: ${value.parentId}`
      )
    }

    const activated = this._sceneGraph.activateTombstoneSubtree(index)
    if (!activated) {
      return
    }

    if (parentIndex !== NULL_INDEX) {
      this._sceneGraph.insertChildAt(parentIndex, index, Number(value.position))
    }
  }

  private _finalizeLifecycleTombstone(
    record: INodeMutationRecord,
    value: unknown
  ) {
    if (!isLifecyclePayload(value)) {
      return
    }

    const tombstoneIndex = this._sceneGraph.getTombstoneIndex(record.id)
    if (tombstoneIndex >= 0) {
      this._sceneGraph.finalizeTombstoneSubtree(tombstoneIndex)
    }
  }

  private _readParentId(value: unknown): IDType | null {
    if (value === null || typeof value === 'string') {
      return value as IDType | null
    }
    if (isPlacement(value)) {
      return value.parentId
    }
    throw new Error('[MutationRecordApplier] Expected parent placement')
  }
}
