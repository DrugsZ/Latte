import {
  DIRTY_SUBTREE_MATRIX,
  MATRIX_AFFECTING_FLAGS,
  MAX_NODES,
  NULL_INDEX,
} from './config'

export class MutationTracker {
  private _dirtyNodes = new Map<number, number>()

  private _parentArray: Int32Array | null = null

  public setParentArray(parentArray: Int32Array) {
    this._parentArray = parentArray
  }

  public mark(index: number, flag: number) {
    const currentFlags = this._dirtyNodes.get(index) || 0
    this._dirtyNodes.set(index, currentFlags | flag)

    // Only matrix-affecting flags need subtree bubbling
    if (flag & MATRIX_AFFECTING_FLAGS) {
      this._bubbleUpDirtySubtree(index)
    }
  }

  public clear(index: number) {
    this._dirtyNodes.delete(index)
  }

  private _bubbleUpDirtySubtree(index: number) {
    if (!this._parentArray) return

    const visited = new Set<number>()
    let parentIndex = this._parentArray[index]

    while (parentIndex !== NULL_INDEX) {
      if (visited.has(parentIndex) || visited.size > MAX_NODES) {
        throw new Error(`Tree cycle detected at node ${parentIndex}`)
      }
      visited.add(parentIndex)

      const parentFlags = this._dirtyNodes.get(parentIndex) || 0

      if (parentFlags & DIRTY_SUBTREE_MATRIX) {
        break
      }

      this._dirtyNodes.set(parentIndex, parentFlags | DIRTY_SUBTREE_MATRIX)

      parentIndex = this._parentArray[parentIndex]
    }
  }

  public get hasChanges() {
    return this._dirtyNodes.size > 0
  }

  public getSnapshot(): Map<number, number> {
    return new Map(this._dirtyNodes)
  }

  public flush(): Map<number, number> {
    const snapshot = new Map(this._dirtyNodes)

    this._dirtyNodes.clear()

    return snapshot
  }
}
