import { MAX_NODES } from './config'

export class Allocator {
  private _freeList: number[] = []

  private _cursor = 1
  public readonly generations = new Uint8Array(new SharedArrayBuffer(MAX_NODES))

  public alloc(): { index: number; generation: number } {
    let index: number

    if (this._freeList.length > 0) {
      index = this._freeList.pop()!
    } else {
      if (this._cursor >= MAX_NODES) {
        throw new Error(`[Allocator] Out of memory! Max nodes: ${MAX_NODES}`)
      }
      index = this._cursor++
    }
    return { index, generation: this.generations[index] }
  }
  public free(index: number) {
    this._freeList.push(index)
    this.generations[index]++
  }
  public isValid(index: number, gen: number): boolean {
    return index < this._cursor && this.generations[index] === gen
  }
}
