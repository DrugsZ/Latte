import { mat2, type mat2d } from 'gl-matrix'

/**
 * Apply stretch (scale) to matrix and size, baking the result.
 *
 * In Figma-like behavior:
 * - When resizing horizontally (scaleX), the X-axis vector (u) is scaled
 * - When resizing vertically (scaleY), the Y-axis vector (v) is scaled
 * - The matrix columns remain as direction vectors (normalized)
 * - The actual scale is baked into width/height
 *
 * Matrix structure: [a, b, c, d, tx, ty]
 * - u = [a, b] * width  → X-axis in world space
 * - v = [c, d] * height → Y-axis in world space
 *
 * @param matrix The local transform matrix (will be modified in place)
 * @param size Object containing width/height (will be modified in place)
 * @param scaleX Horizontal scale factor
 * @param scaleY Vertical scale factor
 */
export function applyStretchToMatrix(
  matrix: mat2d,
  size: { width: number; height: number },
  scaleX: number,
  scaleY: number
) {
  const EPSILON = 1e-6

  // Extract actual axis vectors (including current size)
  let ux = matrix[0] * size.width
  let uy = matrix[1] * size.width
  let vx = matrix[2] * size.height
  let vy = matrix[3] * size.height

  // Apply scale: scaleX affects x-components, scaleY affects y-components
  ux *= scaleX
  uy *= scaleY
  vx *= scaleX
  vy *= scaleY

  // Calculate new dimensions from scaled vectors
  const newWidth = Math.sqrt(ux * ux + uy * uy)
  const newHeight = Math.sqrt(vx * vx + vy * vy)

  // Update size
  size.width = newWidth
  size.height = newHeight

  // Normalize matrix columns (keep direction, bake scale into size)
  if (newWidth > EPSILON) {
    matrix[0] = ux / newWidth
    matrix[1] = uy / newWidth
  }

  if (newHeight > EPSILON) {
    matrix[2] = vx / newHeight
    matrix[3] = vy / newHeight
  }
}

/**
 * 计算 M^(-1) * S * M，其中 S 为对角缩放矩阵
 * @param accumulatedMatrix 累积变换的 2x2 部分 (mat2)
 * @param scaleX X 缩放因子
 * @param scaleY Y 缩放因子
 * @returns 结果 mat2
 */
export function computeStretchTransform(
  accumulatedMatrix: mat2,
  scaleX: number,
  scaleY: number
): mat2 {
  const S = mat2.fromValues(scaleX, 0, 0, scaleY)
  const M_inv = mat2.invert(mat2.create(), accumulatedMatrix)!
  const temp = mat2.multiply(mat2.create(), M_inv, S)
  return mat2.multiply(mat2.create(), temp, accumulatedMatrix)
}

/**
 * 将 mat2 变换应用到矩阵（保持列向量为方向，宽高记入 size）
 */
export function applyTransform2x2ToMatrix(
  matrix: mat2d,
  size: { width: number; height: number },
  t: mat2
) {
  const EPSILON = 1e-6

  const ux = matrix[0] * size.width
  const uy = matrix[1] * size.width
  const vx = matrix[2] * size.height
  const vy = matrix[3] * size.height

  // mat2 layout: [m00, m01, m10, m11] (column-major)
  // 应用变换: newU = t * u, newV = t * v
  const newUx = t[0] * ux + t[2] * uy
  const newUy = t[1] * ux + t[3] * uy
  const newVx = t[0] * vx + t[2] * vy
  const newVy = t[1] * vx + t[3] * vy

  const newWidth = Math.sqrt(newUx * newUx + newUy * newUy)
  const newHeight = Math.sqrt(newVx * newVx + newVy * newVy)

  size.width = newWidth
  size.height = newHeight

  if (newWidth > EPSILON) {
    matrix[0] = newUx / newWidth
    matrix[1] = newUy / newWidth
  }

  if (newHeight > EPSILON) {
    matrix[2] = newVx / newHeight
    matrix[3] = newVy / newHeight
  }
}

/**
 * 从 mat2d 提取 2x2 部分为 mat2
 */
export function extractMat2(m: mat2d): mat2 {
  return mat2.fromValues(m[0], m[1], m[2], m[3])
}
