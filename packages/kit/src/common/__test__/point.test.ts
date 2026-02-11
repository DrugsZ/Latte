import { describe, expect, it } from 'vitest'

import { Point } from '../point'

describe('Point', () => {
  it('should create point with default values', () => {
    const p = new Point()
    expect(p.x).toBe(0)
    expect(p.y).toBe(0)
  })

  it('should create point with specified values', () => {
    const p = new Point(10, 20)
    expect(p.x).toBe(10)
    expect(p.y).toBe(20)
  })

  it('should check equality statically', () => {
    expect(Point.equals(new Point(1, 1), new Point(1, 1))).toBe(true)
    expect(Point.equals(new Point(1, 1), new Point(1, 2))).toBe(false)
    expect(Point.equals(null, null)).toBe(true)
    expect(Point.equals(undefined, undefined)).toBe(true)
    expect(Point.equals(new Point(), null)).toBe(false)
  })

  it('should check equality instance method', () => {
    const p1 = new Point(5, 5)
    const p2 = new Point(5, 5)
    const p3 = new Point(5, 6)

    expect(p1.equals(p2)).toBe(true)
    expect(p1.equals(p3)).toBe(false)
  })

  it('should clone correctly', () => {
    const p1 = new Point(10, 20)
    const p2 = p1.clone()

    expect(p2).not.toBe(p1) // Different reference
    expect(p2.equals(p1)).toBe(true)
  })

  it('should copy from another point', () => {
    const p1 = new Point(0, 0)
    const p2 = new Point(10, 20)

    p1.copyFrom(p2)
    expect(p1.x).toBe(10)
    expect(p1.y).toBe(20)
  })
})
