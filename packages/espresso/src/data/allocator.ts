// packages/espresso/src/data/Allocator.ts

import { MAX_NODES } from './config'

export class Allocator {
  // 回收站：存放被删除的 index
  private _freeList: number[] = []

  // 水位线：当前分配到的最大 index
  private _cursor = 1 // 0 预留给 ROOT 或 NULL

  // --- 核心：代数数组 (Generation) ---
  // 用于检测悬挂指针。每次 ID 被回收并重新分配时，代数 +1。
  // 如果外部持有的 Handle.generation !== internal.generation，说明 Handle 过期了。
  // Uint8 足够了 (0-255 循环)，碰撞概率极低。
  public readonly generations = new Uint8Array(new SharedArrayBuffer(MAX_NODES))

  /**
   * 申请一个 ID
   * @returns [index, generation]
   */
  public alloc(): { index: number; generation: number } {
    let index: number

    if (this._freeList.length > 0) {
      // 1. 复用旧 ID
      index = this._freeList.pop()!
    } else {
      // 2. 分配新 ID
      if (this._cursor >= MAX_NODES) {
        throw new Error(`[Allocator] Out of memory! Max nodes: ${MAX_NODES}`)
      }
      index = this._cursor++
    }

    // 注意：分配时不增加代数，释放时才增加，或者分配时增加也可以。
    // 这里采用：Slot 上的 generation 代表当前活着的代数。
    return { index, generation: this.generations[index] }
  }

  /**
   * 释放 ID
   */
  public free(index: number) {
    // 1. 放入回收站
    this._freeList.push(index)

    // 2. 代数自增 (表示上一代已死)
    // 255 + 1 -> 0 (自动溢出回绕)
    this.generations[index]++
  }

  /**
   * 检查句柄有效性
   */
  public isValid(index: number, gen: number): boolean {
    return index < this._cursor && this.generations[index] === gen
  }
}
