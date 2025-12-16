import type { HeapManager } from './heapManager'
import { NULL_INDEX } from './config'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class BlobManager {
  private _cache = new Map<number, string | object | null>()

  constructor(private _heap: HeapManager) {}

  /**
   * @param data
   */
  public write(data: string | object): number {
    const isString = typeof data === 'string'
    const jsonStr = isString ? data : JSON.stringify(data)

    const bytes = encoder.encode(jsonStr)
    this._heap.write(bytes)
    const ptr = this._heap.write(bytes)

    this._cache.set(ptr, data)

    return ptr
  }

  /**
   * @param ptr
   * @param isRawString
   */
  public read<T = string>(ptr: number, isRawString = false): T | null {
    if (ptr === NULL_INDEX || ptr === 0) return null

    if (this._cache.has(ptr)) {
      return this._cache.get(ptr) as T
    }

    const bytes = this._heap.read(ptr)
    if (!bytes) {
      return bytes
    }
    const jsonStr = decoder.decode(bytes)

    let result: string | object | null = null
    try {
      if (isRawString) {
        result = jsonStr
      } else {
        result = JSON.parse(jsonStr)
      }
    } catch (e) {
      console.error(`[BlobManager] JSON Parse error at ptr ${ptr}`, e)
      result = null
    }

    this._cache.set(ptr, result)

    return result as T
  }

  public reset() {
    this._cache.clear()
  }
}
