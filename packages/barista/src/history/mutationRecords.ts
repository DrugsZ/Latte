import type { INodeMutationRecord } from '@latte-js/espresso'

export const cloneHistoryValue = (value: unknown): unknown => {
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView & {
      readonly length?: number
      [index: number]: number
    }
    if (typeof view.length === 'number') {
      return Array.from(view as ArrayLike<number>)
    }
    return Array.from(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    )
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneHistoryValue(item))
  }

  if (value && typeof value === 'object') {
    if (typeof structuredClone === 'function') {
      return structuredClone(value)
    }
    return JSON.parse(JSON.stringify(value))
  }

  return value
}

export const cloneRecord = (
  record: INodeMutationRecord
): INodeMutationRecord => ({
  id: record.id,
  index: record.index,
  prop: record.prop,
  oldValue: cloneHistoryValue(record.oldValue),
  newValue: cloneHistoryValue(record.newValue),
  dirtyFlag: record.dirtyFlag,
})

export const invertRecord = (
  record: INodeMutationRecord
): INodeMutationRecord => ({
  id: record.id,
  index: record.index,
  prop: record.prop,
  oldValue: cloneHistoryValue(record.newValue),
  newValue: cloneHistoryValue(record.oldValue),
  dirtyFlag: record.dirtyFlag,
})

export const invertRecords = (
  records: readonly INodeMutationRecord[]
): INodeMutationRecord[] => records.slice().reverse().map(invertRecord)
