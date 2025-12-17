export class MutationTracker {
  private _dirtyNodes = new Map<number, number>()

  mark(index: number, flag: number) {
    const currentFlags = this._dirtyNodes.get(index) || 0
    this._dirtyNodes.set(index, currentFlags | flag)
  }

  popAll(): Map<number, number> {
    const snapshot = new Map(this._dirtyNodes)
    this._dirtyNodes.clear()
    return snapshot
  }

  get hasChanges() {
    return this._dirtyNodes.size > 0
  }
}
