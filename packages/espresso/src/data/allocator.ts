import { MAX_NODES } from './config'

export class Allocator {
  private _freeList: number[] = []

  private _cursor = 1
  public readonly generations:Uint8Array

  constructor(existingBuffer?: SharedArrayBuffer) {
    if (existingBuffer) {
      this.generations = new Uint8Array(existingBuffer);
    } else {
      const buffer = new SharedArrayBuffer(MAX_NODES);
      this.generations = new Uint8Array(buffer);
    }
  }

  public alloc(): { index: number; generation: number } {
    let index: number;

    if (this._freeList.length > 0) {
      index = this._freeList.pop()!;
    } else {
      if (this._cursor >= MAX_NODES) throw new Error("OOM");
      index = this._cursor++;
    }

    return { index, generation: this.generations[index] };
  }

  public free(index: number) {
    this._freeList.push(index);

    const nextGen = (this.generations[index] + 1) & 0xFF;
    Atomics.store(this.generations, index, nextGen);
  }
  
  public isValid(index: number, expectedGen: number): boolean {
    const currentGen = Atomics.load(this.generations, index);
    return currentGen === expectedGen;
  }

  public get buffer() {
    return this.generations.buffer as SharedArrayBuffer;
  }
}
