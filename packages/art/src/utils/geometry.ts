import type { vec2 } from 'gl-matrix'

/**
 * Check if a point is inside a polygon using ray casting algorithm (even-odd rule)
 * @param point The point to check [x, y]
 * @param vertices Flat array of vertices [x1, y1, x2, y2, ...]
 */
export function isPointInPolygon(point: vec2, vertices: number[]): boolean {
  const x = point[0]
  const y = point[1]

  let inside = false
  for (let i = 0, j = vertices.length - 2; i < vertices.length; i += 2) {
    const xi = vertices[i]
    const yi = vertices[i + 1]
    const xj = vertices[j]
    const yj = vertices[j + 1]

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
    j = i
  }

  return inside
}
