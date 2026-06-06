import {
  NodeCursor,
  PropId,
  type INodeMutationRecord,
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
      case PropId.REMOVE_SELF:
        throw new Error(
          '[MutationRecordApplier] Cannot replay removeSelf without serialized node snapshot'
        )
      default:
        throw new Error(
          `[MutationRecordApplier] Unsupported history prop: ${String(record.prop)}`
        )
    }
  }

  private _applyParent(cursor: NodeCursor, value: unknown) {
    const parentId = value as IDType | null
    const currentParent = cursor.parent
    if (parentId === null) {
      currentParent?.removeChild(cursor)
      return
    }

    const parentIndex = this._sceneGraph.getIndex(parentId)
    if (parentIndex < 0) {
      throw new Error(`[MutationRecordApplier] Parent not found: ${parentId}`)
    }
    new NodeCursor(this._sceneGraph, parentIndex).appendChild(cursor)
  }
}
