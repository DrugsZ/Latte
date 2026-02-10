import { describe, expect, it, vi } from 'vitest'

import { Allocator } from '../allocator'

vi.mock('../config', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, string>
  return {
    ...actual,
    MAX_NODES: 100,
  }
})

describe('Allocator', () => {
  it('should allocate new indices correctly', () => {
    const allocator = new Allocator()

    const node1 = allocator.alloc()
    const node2 = allocator.alloc()
    expect(node1.index).toBe(1)
    expect(node1.generation).toBe(0)
    expect(node2.index).toBe(2)
    expect(node2.generation).toBe(0)
  })

  it('should reuse indices from free list', () => {
    const allocator = new Allocator()
    const node1 = allocator.alloc()
    const node2 = allocator.alloc()

    allocator.free(node1.index)
    const node3 = allocator.alloc()

    expect(node3.index).toBe(node1.index)
    expect(node3.generation).toBe(1)
  })

  it('should increment generation on free', () => {
    const allocator = new Allocator()
    const node1 = allocator.alloc()

    allocator.free(node1.index)

    expect(allocator.generations[node1.index]).toBe(1)
  })

  it('should validate indices and generations correctly', () => {
    const allocator = new Allocator()
    const node1 = allocator.alloc()
    const node2 = allocator.alloc()

    expect(allocator.isValid(node1.index, node1.generation)).toBe(true)
    expect(allocator.isValid(node2.index, node2.generation)).toBe(true)

    allocator.free(node1.index)
    // Note: isValid currently only checks generation match, not free list status.
    // If we pass the NEW generation, it will return true.
    expect(allocator.isValid(node1.index, node1.generation + 1)).toBe(true)
  })

  it('should throw error when out of memory', () => {
    const allocator = new Allocator()
    for (let i = 1; i < 100; i++) {
      allocator.alloc()
    }
    expect(() => allocator.alloc()).toThrow('OOM')
  })
})
