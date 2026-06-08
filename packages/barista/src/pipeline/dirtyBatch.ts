export class DirtyBatch {
  public static from(map: Map<number, number>) {
    return new DirtyBatch(new Map(map))
  }

  constructor(private readonly _map = new Map<number, number>()) {}

  public get map() {
    return this._map
  }

  public get size() {
    return this._map.size
  }

  public get hasChanges() {
    return this._map.size > 0
  }

  public mark(index: number, flags: number) {
    const current = this._map.get(index) || 0
    this._map.set(index, current | flags)
  }

  public markDerived(index: number, flags: number) {
    this.mark(index, flags)
  }

  public getFlags(index: number) {
    return this._map.get(index) || 0
  }

  public has(index: number) {
    return this._map.has(index)
  }

  public hasFlags(index: number, mask: number) {
    return (this.getFlags(index) & mask) !== 0
  }

  public hasAny(mask: number) {
    for (const flags of this._map.values()) {
      if ((flags & mask) !== 0) {
        return true
      }
    }
    return false
  }

  public entries() {
    return this._map.entries()
  }

  public keys() {
    return this._map.keys()
  }

  public entriesByMask(mask: number) {
    return Array.from(this._map.entries()).filter(
      ([, flags]) => (flags & mask) !== 0
    )
  }

  public keysByMask(mask: number) {
    return this.entriesByMask(mask).map(([index]) => index)
  }

  public idsByMask<T>(mask: number, resolveId: (index: number) => T | null) {
    const ids: T[] = []
    for (const [index, flags] of this._map) {
      if ((flags & mask) === 0) {
        continue
      }
      const id = resolveId(index)
      if (id !== null) {
        ids.push(id)
      }
    }
    return ids
  }
}
