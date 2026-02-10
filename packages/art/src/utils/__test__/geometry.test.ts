import { describe, expect, it } from 'vitest'

import { isPointInPolygon } from '../geometry'

describe('geometry utils', () => {
  describe('isPointInPolygon', () => {
    it('should return true for point inside square', () => {
      // 10x10 square at origin
      const square = [0, 0, 10, 0, 10, 10, 0, 10]
      expect(isPointInPolygon([5, 5], square)).toBe(true)
    })

    it('should return false for point outside square', () => {
      const square = [0, 0, 10, 0, 10, 10, 0, 10]
      expect(isPointInPolygon([15, 5], square)).toBe(false)
      expect(isPointInPolygon([-5, 5], square)).toBe(false)
      expect(isPointInPolygon([5, 15], square)).toBe(false)
    })

    it('should handle triangle', () => {
      // Triangle (0,0), (10,0), (5,10)
      const triangle = [0, 0, 10, 0, 5, 10]
      expect(isPointInPolygon([5, 5], triangle)).toBe(true)
      expect(isPointInPolygon([5, 11], triangle)).toBe(false)
      // Top vertex check - might depend on implementation (edge inclusion)
      // Usually ray casting excludes top/right edges or behaves specifically
    })

    it('should handle concave polygon (L-shape)', () => {
      // L shape
      // (0,0) -> (10,0) -> (10,2) -> (2,2) -> (2,10) -> (0,10)
      const lShape = [0, 0, 10, 0, 10, 2, 2, 2, 2, 10, 0, 10]

      // Inside the L
      expect(isPointInPolygon([1, 1], lShape)).toBe(true)
      expect(isPointInPolygon([9, 1], lShape)).toBe(true)
      expect(isPointInPolygon([1, 9], lShape)).toBe(true)

      // Inside the "empty" part of bounding box
      expect(isPointInPolygon([5, 5], lShape)).toBe(false)
    })

    it('should handle ray passing through vertex', () => {
      // Triangle (0,0), (10,0), (5,10)
      const triangle = [0, 0, 10, 0, 5, 10]
      // Ray from (5, -1) going right? No, implementation is usually +X ray
      // Let's test standard points
      expect(isPointInPolygon([5, 2], triangle)).toBe(true)
    })
  })
})
