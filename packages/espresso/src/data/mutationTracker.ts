export class MutationTracker {
  private _dirtyNodes = new Map<number, number>()

  private _isFlushing = false

  public getIsFlushing() {
    return this._isFlushing
  }

  public setFlushing(value: boolean) {
    this._isFlushing = value
  }

  public mark(index: number, flag: number) {
    if (this.getIsFlushing()) {
      return
    }
    const currentFlags = this._dirtyNodes.get(index) || 0
    this._dirtyNodes.set(index, currentFlags | flag)
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
