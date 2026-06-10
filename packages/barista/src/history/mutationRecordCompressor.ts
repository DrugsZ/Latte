import { PropId, type INodeMutationRecord } from '@latte-js/espresso'

import { cloneRecord, cloneHistoryValue } from './mutationRecords'

const STRUCTURAL_PROPS = new Set<PropId>([PropId.PARENT, PropId.REMOVE_SELF])

const recordKey = (record: INodeMutationRecord) =>
  `${record.id}:${String(record.prop)}`

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const historyValueEquals = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }
    return left.every((value, index) => historyValueEquals(value, right[index]))
  }

  if (isObjectLike(left) && isObjectLike(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }
    return leftKeys.every(key => historyValueEquals(left[key], right[key]))
  }

  return false
}

const isNoopRecord = (record: INodeMutationRecord) =>
  historyValueEquals(record.oldValue, record.newValue)

export class MutationRecordCompressor {
  private _segment: INodeMutationRecord[] = []
  private _segmentByKey = new Map<string, number>()

  public compress(records: readonly INodeMutationRecord[]) {
    const result: INodeMutationRecord[] = []

    this._resetSegment()

    for (const record of records) {
      if (this._isBarrier(record)) {
        this._flushSegment(result)
        result.push(cloneRecord(record))
        continue
      }

      this._acceptRecord(record)
    }

    this._flushSegment(result)
    return result.filter(record => !isNoopRecord(record))
  }

  private _acceptRecord(record: INodeMutationRecord) {
    const key = recordKey(record)
    const existingIndex = this._segmentByKey.get(key)

    if (existingIndex === undefined) {
      this._segmentByKey.set(key, this._segment.length)
      this._segment.push(cloneRecord(record))
      return
    }

    const existing = this._segment[existingIndex]
    this._segment[existingIndex] = {
      ...existing,
      newValue: cloneHistoryValue(record.newValue),
      dirtyFlag: existing.dirtyFlag | record.dirtyFlag,
    }
  }

  private _flushSegment(target: INodeMutationRecord[]) {
    for (const record of this._segment) {
      target.push(record)
    }
    this._resetSegment()
  }

  private _resetSegment() {
    this._segment = []
    this._segmentByKey.clear()
  }

  private _isBarrier(record: INodeMutationRecord) {
    return STRUCTURAL_PROPS.has(record.prop)
  }
}
