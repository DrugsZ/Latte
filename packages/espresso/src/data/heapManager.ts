import { DEFAULT_HEAP_SIZE, LITTLE_ENDIAN } from './config.js'

export class HeapManager {
  public buffer: SharedArrayBuffer
  public view: Uint8Array
  private _cursor: number = 0

  constructor(existingBuffer?: SharedArrayBuffer) {
    if (existingBuffer) {
      this.buffer = existingBuffer
    } else {
      this.buffer = new SharedArrayBuffer(DEFAULT_HEAP_SIZE)
    }
    this.view = new Uint8Array(this.buffer)
  }

  public alloc(size: number): number {
    if (this._cursor + size > this.buffer.byteLength) {
      this._resize(
        Math.max(this.buffer.byteLength * 2, this._cursor + size + 1024)
      )
    }

    const ptr = this._cursor

    this._cursor += size

    const padding = this._cursor % 4
    if (padding !== 0) {
      this._cursor += LITTLE_ENDIAN - padding
    }

    return ptr
  }

  public write(data: Uint8Array): number {
    const contentLen = data.byteLength
    const totalSize = 4 + contentLen
    const ptr = this.alloc(totalSize)
    const view = new DataView(this.buffer, ptr, 4)
    view.setUint32(0, contentLen, true)
    this.view.set(data, ptr + 4)
    return ptr
  }

  public read(ptr: number): Uint8Array | null {
    if (ptr + 4 > this.buffer.byteLength) {
      console.warn(`[BlobManager] Pointer out of bounds: ${ptr}`)
      return null
    }
    const view = new DataView(this.buffer, ptr, 4)
    const contentLen = view.getUint32(0, true)
    if (contentLen === 0) {
      return null
    }
    return this.view.subarray(ptr + 4, ptr + 4 + contentLen)
  }

  private _resize(newSize: number) {
    console.warn(
      `[HeapManager] Resizing Heap: ${(this.buffer.byteLength / 1024).toFixed(0)}KB -> ${(newSize / 1024).toFixed(0)}KB`
    )

    const newBuffer = new SharedArrayBuffer(newSize)
    const newView = new Uint8Array(newBuffer)

    newView.set(this.view)

    this.buffer = newBuffer
    this.view = newView
  }
}
