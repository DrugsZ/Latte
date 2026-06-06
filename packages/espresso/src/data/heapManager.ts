import { DEFAULT_HEAP_SIZE, LITTLE_ENDIAN } from './config.js'

interface HeapManagerOptions {
  resizable?: boolean
}

export class HeapManager {
  public buffer: SharedArrayBuffer
  public view: Uint8Array
  private _cursor: Int32Array
  private _resizable: boolean

  constructor(
    existingBuffer?: SharedArrayBuffer,
    options: HeapManagerOptions = {}
  ) {
    if (existingBuffer) {
      this.buffer = existingBuffer
    } else {
      this.buffer = new SharedArrayBuffer(DEFAULT_HEAP_SIZE)
    }
    this.view = new Uint8Array(this.buffer)
    this._cursor = new Int32Array(this.buffer, 0, 1)
    this._resizable = options.resizable ?? true

    if (Atomics.load(this._cursor, 0) === 0) {
      Atomics.store(this._cursor, 0, 4)
    }
  }

  public alloc(size: number): number {
    const alignedSize = this._align(size)
    let ptr = Atomics.load(this._cursor, 0)

    if (ptr + alignedSize > this.buffer.byteLength) {
      if (!this._resizable) {
        throw new Error(
          `[HeapManager] Out of shared heap memory: ${ptr + alignedSize}/${this.buffer.byteLength}`
        )
      }
      this._resize(
        Math.max(this.buffer.byteLength * 2, ptr + alignedSize + 1024)
      )
      ptr = Atomics.load(this._cursor, 0)
    }

    Atomics.store(this._cursor, 0, ptr + alignedSize)
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
    this._cursor = new Int32Array(this.buffer, 0, 1)
  }

  private _align(size: number) {
    const padding = size % 4
    if (padding === 0) {
      return size
    }
    return size + (LITTLE_ENDIAN - padding)
  }
}
