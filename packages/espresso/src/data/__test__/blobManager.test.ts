import { describe, expect, it, vi } from 'vitest'

import { BlobManager } from '../blobManager'
import { NULL_INDEX } from '../config'

import type { HeapManager } from '../heapManager'

describe('BlobManager', () => {
  const mockHeap = {
    write: vi.fn().mockReturnValue(123),
    read: vi.fn().mockReturnValue(new TextEncoder().encode('{"foo":"bar"}')),
  } as unknown as HeapManager

  it('should write string data to heap and cache it', () => {
    const blobManager = new BlobManager(mockHeap)
    const data = 'test-string'

    const ptr = blobManager.write(data)

    expect(ptr).toBe(123)
    expect(mockHeap.write).toHaveBeenCalled()
    // Internal cache check via read
    expect(blobManager.read(ptr, true)).toBe(data)
  })

  it('should write object data to heap as JSON', () => {
    const blobManager = new BlobManager(mockHeap)
    const data = { hello: 'world' }

    const ptr = blobManager.write(data)

    expect(ptr).toBe(123)
    expect(mockHeap.write).toHaveBeenCalled()
    expect(blobManager.read(ptr)).toEqual(data)
  })

  it('should read from cache if available', () => {
    const blobManager = new BlobManager(mockHeap)
    const data = 'cached'
    const ptr = blobManager.write(data)
    vi.clearAllMocks()

    const result = blobManager.read(ptr, true)

    expect(result).toBe(data)
    expect(mockHeap.read).not.toHaveBeenCalled()
  })

  it('should read from heap if not in cache', () => {
    const blobManager = new BlobManager(mockHeap)
    const ptr = 456
    const mockData = { test: 1 }
    const bytes = new TextEncoder().encode(JSON.stringify(mockData))
    vi.mocked(mockHeap.read).mockReturnValue(bytes)

    const result = blobManager.read(ptr)

    expect(result).toEqual(mockData)
    expect(mockHeap.read).toHaveBeenCalledWith(ptr)
  })

  it('should return null for NULL_INDEX or 0', () => {
    const blobManager = new BlobManager(mockHeap)

    expect(blobManager.read(NULL_INDEX)).toBeNull()
    expect(blobManager.read(0)).toBeNull()
  })

  it('should return null if heap read returns null', () => {
    const blobManager = new BlobManager(mockHeap)
    vi.mocked(mockHeap.read).mockReturnValue(null)

    const result = blobManager.read(123)

    expect(result).toBeNull()
  })

  it('should handle invalid JSON in read', () => {
    const blobManager = new BlobManager(mockHeap)
    const ptr = 789
    const invalidBytes = new Uint8Array([1, 2, 3])
    vi.mocked(mockHeap.read).mockReturnValue(invalidBytes)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = blobManager.read(ptr)

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should reset cache', () => {
    const blobManager = new BlobManager(mockHeap)
    const ptr = blobManager.write('data')
    vi.clearAllMocks()

    blobManager.reset()
    blobManager.read(ptr)

    expect(mockHeap.read).toHaveBeenCalled()
  })

  it('should return raw string when isRawString is true', () => {
    const blobManager = new BlobManager(mockHeap)
    const ptr = 101
    const jsonStr = '{"a":1}'
    vi.mocked(mockHeap.read).mockReturnValue(new TextEncoder().encode(jsonStr))

    const result = blobManager.read(ptr, true)

    expect(result).toBe(jsonStr)
  })
})
