import type { mat2d } from 'gl-matrix'

/**
 * Apply stretch (scale) to matrix and size, baking the result.
 * This ensures that the matrix remains normalized (unit vectors for columns)
 * and the scale is reflected in the width and height.
 */
export function applyStretchToMatrix(
  matrix: mat2d,
  size: { width: number; height: number },
  scaleX: number,
  scaleY: number
) {
  const EPSILON = 1e-6

  let ux = matrix[0] * size.width
  let uy = matrix[1] * size.width
  let vx = matrix[2] * size.height
  let vy = matrix[3] * size.height

  ux *= scaleX
  uy *= scaleY
  vx *= scaleX
  vy *= scaleY

  const newWidth = Math.sqrt(ux * ux + uy * uy)
  const newHeight = Math.sqrt(vx * vx + vy * vy)

  size.width = newWidth
  size.height = newHeight

  if (newWidth > EPSILON) {
    matrix[0] = ux / newWidth
    matrix[1] = uy / newWidth
  }

  if (newHeight > EPSILON) {
    matrix[2] = vx / newHeight
    matrix[3] = vy / newHeight
  }
}
