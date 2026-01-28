import { DIRTY_SUBTREE, NULL_INDEX } from './config'

export class MutationTracker {
  private _dirtyNodes = new Map<number, number>()

  private _isFlushing = false

  private _parentArray: Int32Array | null = null

  public getIsFlushing() {
    return this._isFlushing
  }

  public setFlushing(value: boolean) {
    this._isFlushing = value
  }

  public setParentArray(parentArray: Int32Array) {
    this._parentArray = parentArray
  }

  public mark(index: number, flag: number) {
    if (this.getIsFlushing()) {
      return
    }
    const currentFlags = this._dirtyNodes.get(index) || 0
    this._dirtyNodes.set(index, currentFlags | flag)

    this._bubbleUpDirtySubtree(index)
  }

  private _bubbleUpDirtySubtree(index: number) {
    if (!this._parentArray) return

    let parentIndex = this._parentArray[index]

    while (parentIndex !== NULL_INDEX) {
      const parentFlags = this._dirtyNodes.get(parentIndex) || 0

      if (parentFlags & DIRTY_SUBTREE) {
        break
      }

      this._dirtyNodes.set(parentIndex, parentFlags | DIRTY_SUBTREE)

      parentIndex = this._parentArray[parentIndex]
    }
  }

  public get hasChanges() {
    return this._dirtyNodes.size > 0
  }

  public getSnapshot(): Map<number, number> {
    return this._dirtyNodes
  }

  public flush(): Map<number, number> {
    const snapshot = new Map(this._dirtyNodes)

    this._dirtyNodes.clear()

    return snapshot
  }
}
