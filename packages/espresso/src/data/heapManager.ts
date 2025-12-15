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

  public write(data: Uint8Array, oldPtr: number): number {
    const oldData = this.read(oldPtr, data.byteLength)
    const ptr = this.alloc(data.byteLength)
    this.view.set(data, ptr)
    return ptr
  }

  public read(ptr: number, length: number): Uint8Array {
    return this.view.subarray(ptr, ptr + length)
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
