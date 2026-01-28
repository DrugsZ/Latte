import {
  DIRTY_SUBTREE_MATRIX,
  DIRTY_SUBTREE_BOUNDS,
  MATRIX_AFFECTING_FLAGS,
  BOUNDS_AFFECTING_FLAGS,
  DIRTY_NOT_EFFECT,
  NULL_INDEX,
} from './config'

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

    // Skip bubbling for flags that don't affect layout
    if (flag & DIRTY_NOT_EFFECT) {
      return
    }

    // Determine which subtree flags to bubble
    let subtreeFlags = 0
    if (flag & MATRIX_AFFECTING_FLAGS) {
      subtreeFlags |= DIRTY_SUBTREE_MATRIX | DIRTY_SUBTREE_BOUNDS
    } else if (flag & BOUNDS_AFFECTING_FLAGS) {
      subtreeFlags |= DIRTY_SUBTREE_BOUNDS
    }

    if (subtreeFlags !== 0) {
      this._bubbleUpDirtySubtree(index, subtreeFlags)
    }
  }

  private _bubbleUpDirtySubtree(index: number, subtreeFlags: number) {
    if (!this._parentArray) return

    let parentIndex = this._parentArray[index]

    while (parentIndex !== NULL_INDEX) {
      const parentFlags = this._dirtyNodes.get(parentIndex) || 0
      const missingFlags = subtreeFlags & ~parentFlags

      if (missingFlags === 0) {
        // All required subtree flags already set, stop bubbling
        break
      }

      this._dirtyNodes.set(parentIndex, parentFlags | missingFlags)

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
