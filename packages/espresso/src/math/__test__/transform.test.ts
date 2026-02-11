import { mat2, mat2d } from 'gl-matrix'
import { describe, expect, it } from 'vitest'

import { applyStretchToMatrix, computeStretchTransform } from '../transform'

describe('transform utils', () => {
  describe('applyStretchToMatrix', () => {
    it('should scale identity matrix and update size', () => {
      const matrix = mat2d.create() // Identity
      const size = { width: 100, height: 100 }

      applyStretchToMatrix(matrix, size, 2, 0.5)

      expect(size.width).toBe(200) // 100 * 2
      expect(size.height).toBe(50) // 100 * 0.5

      // Matrix should remain identity because it's normalized direction vectors
      // and we just scaled along X and Y axes which match the matrix axes
      expect(matrix[0]).toBeCloseTo(1)
      expect(matrix[3]).toBeCloseTo(1)
    })

    it('should handle rotation (World Space Scaling)', () => {
      const matrix = mat2d.create()
      // Rotate 90 degrees
      mat2d.rotate(matrix, matrix, Math.PI / 2)

      // Initial: Width vector is (0, 1), Height vector is (-1, 0)
      // Size: 100, 100
      const size = { width: 100, height: 100 }

      // Apply scale (2, 1) in World Space
      // Scale X by 2.
      // Scale Y by 1.
      // Width vector (0, 1) -> (0*2, 1*1) = (0, 100). Length 100.
      // Height vector (-1, 0) -> (-1*2, 0*1) = (-2, 0) * 100 = (-200, 0). Length 200.

      applyStretchToMatrix(matrix, size, 2, 1)

      expect(size.width).toBeCloseTo(100)
      expect(size.height).toBeCloseTo(200)

      // Matrix columns should be normalized
      // Col 0 (Width dir): (0, 100) normalized -> (0, 1)
      expect(matrix[0]).toBeCloseTo(0)
      expect(matrix[1]).toBeCloseTo(1)

      // Col 1 (Height dir): (-200, 0) normalized -> (-1, 0)
      expect(matrix[2]).toBeCloseTo(-1)
      expect(matrix[3]).toBeCloseTo(0)
    })
  })

  describe('computeStretchTransform', () => {
    it('should compute stretch correctly for identity', () => {
      const accum = mat2.create()
      const result = computeStretchTransform(accum, 2, 3)

      // Result should be scale matrix (2, 3)
      expect(result[0]).toBeCloseTo(2)
      expect(result[3]).toBeCloseTo(3)
    })
  })
})
