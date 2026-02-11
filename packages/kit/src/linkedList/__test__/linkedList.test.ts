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
})
