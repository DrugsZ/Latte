import { NULL_INDEX } from './config'

import type { HeapManager } from './heapManager'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const encodeBlob = (data: string | object) => {
  const isString = typeof data === 'string'
  const jsonStr = isString ? data : JSON.stringify(data)

  return encoder.encode(jsonStr)
}

export class BlobManager {
  private _cache = new Map<number, string | object | null>()

  constructor(private _heap: HeapManager) {}

  /**
   * @param data
   */
  public write(data: string | object): number {
    const bytes = encodeBlob(data)
    return this._writeEncoded(data, bytes)
  }

  private _writeEncoded(data: string | object, bytes: Uint8Array) {
    const ptr = this._heap.write(bytes)

    this._cache.set(ptr, data)

    return ptr
  }

  public replace(ptr: number, data: string | object): number {
    const bytes = encodeBlob(data)
    const newPtr = this._writeEncoded(data, bytes)
    this.release(ptr)
    return newPtr
  }

  public release(ptr: number): boolean {
    if (ptr === NULL_INDEX || ptr <= 0) {
      return false
    }

    this._cache.delete(ptr)
    return this._heap.free(ptr)
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
    const decodeBytes =
      bytes.buffer instanceof SharedArrayBuffer ? Uint8Array.from(bytes) : bytes
    const jsonStr = decoder.decode(decodeBytes)

    let result: string | object | null
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

  public dispose() {
    this.reset()
  }
}
