import { describe, expect, it } from 'vitest'

import { LinkedList } from '../linkedList'

describe('LinkedList', () => {
  it('should start empty', () => {
    const list = new LinkedList<number>()
    expect(list.size).toBe(0)
    expect(list.isEmpty()).toBe(true)
    expect(list.shift()).toBeUndefined()
    expect(list.pop()).toBeUndefined()
  })

  it('should push elements to the end', () => {
    const list = new LinkedList<number>()
    list.push(1)
    list.push(2)

    expect(list.size).toBe(2)
    expect(list.isEmpty()).toBe(false)

    // Pop should return from end
    expect(list.pop()).toBe(2)
    expect(list.pop()).toBe(1)
    expect(list.isEmpty()).toBe(true)
  })

  it('should unshift elements to the beginning', () => {
    const list = new LinkedList<number>()
    list.unshift(1)
    list.unshift(2) // List: 2 -> 1

    expect(list.size).toBe(2)

    // Shift should return from start
    expect(list.shift()).toBe(2)
    expect(list.shift()).toBe(1)
    expect(list.isEmpty()).toBe(true)
  })

  it('should remove elements via returned function', () => {
    const list = new LinkedList<number>()
    const remove1 = list.push(1)
    const remove2 = list.push(2)
    const remove3 = list.push(3)

    expect(list.size).toBe(3)

    remove2() // Remove middle
    expect(list.size).toBe(2)

    // 1 -> 3
    expect(list.shift()).toBe(1)
    expect(list.shift()).toBe(3)

    // Calling remove again should do nothing
    remove2()
    expect(list.size).toBe(0)
  })

  it('should clear the list', () => {
    const list = new LinkedList<number>()
    list.push(1)
    list.push(2)

    list.clear()

    expect(list.size).toBe(0)
    expect(list.isEmpty()).toBe(true)
    expect(list.pop()).toBeUndefined()
  })

  it('should clear an empty list repeatedly', () => {
    const list = new LinkedList<number>()

    list.clear()
    list.clear()

    expect(list.size).toBe(0)
    expect([...list]).toEqual([])
  })

  it('should clear a single-node list repeatedly', () => {
    const list = new LinkedList<number>()
    list.push(1)

    list.clear()
    list.clear()

    expect(list.size).toBe(0)
    expect(list.isEmpty()).toBe(true)
    expect([...list]).toEqual([])
  })

  it('should clear a multi-node list and leave it reusable', () => {
    const list = new LinkedList<number>()
    list.push(1)
    list.push(2)
    list.push(3)

    list.clear()
    list.clear()
    const remove = list.push(4)

    expect(list.size).toBe(1)
    expect([...list]).toEqual([4])
    remove()
    expect(list.size).toBe(0)
  })

  it('should ignore stale removers after clear', () => {
    const list = new LinkedList<number>()
    const removeOld = list.push(1)

    list.clear()
    const removeNew = list.push(2)
    removeOld()

    expect(list.size).toBe(1)
    expect([...list]).toEqual([2])

    removeOld()
    removeNew()
    expect(list.size).toBe(0)
  })

  it('should keep iterating when the current node removes itself', () => {
    const list = new LinkedList<number>()
    const removeFirst = list.push(1)
    list.push(2)
    const visited: number[] = []

    for (const value of list) {
      visited.push(value)
      if (value === 1) {
        removeFirst()
      }
    }

    expect(visited).toEqual([1, 2])
    expect([...list]).toEqual([2])
    expect(list.size).toBe(1)
  })
})
