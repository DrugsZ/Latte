import { describe, expect, it, vi } from 'vitest'

import { HeapManager } from '../heapManager'

describe('HeapManager', () => {
  it('alloc returns 4-byte aligned pointers', () => {
    const heap = new HeapManager()
    const p1 = heap.alloc(5)
    const p2 = heap.alloc(5)

    expect(p1 % 4).toBe(0)
    expect(p2 % 4).toBe(0)
    expect(p2).toBeGreaterThanOrEqual(p1 + 5)
  })

  it('write and read roundtrip', () => {
    const heap = new HeapManager()
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const ptr = heap.write(data)

    const result = heap.read(ptr)
    expect(result).toEqual(data)
  })

  it('automatic resize on overflow', () => {
    const smallBuffer = new SharedArrayBuffer(1024)
    const heap = new HeapManager(smallBuffer)
    const size = 600
    const data = new Uint8Array(size).fill(1)

    heap.write(data) // ~608 bytes used
    const initialCapacity = heap.buffer.byteLength

    // This one should trigger resize
    const ptr = heap.write(data)
    expect(heap.buffer.byteLength).toBeGreaterThan(initialCapacity)

    const readData = heap.read(ptr)
    expect(readData).not.toBeNull()
    expect(readData!.length).toBe(size)
    expect(readData![0]).toBe(1)
  })

  it('read should return null if pointer out of bounds', () => {
    const heap = new HeapManager()
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = heap.read(heap.buffer.byteLength + 1)
    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Pointer out of bounds')
    )
    consoleSpy.mockRestore()
  })

  it('read should return null if contentLen is 0', () => {
    const heap = new HeapManager()
    const data = new Uint8Array(0)
    const ptr = heap.write(data)
    const result = heap.read(ptr)
    expect(result).toBeNull()
  })
})
