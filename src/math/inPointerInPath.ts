export function distance(x1: number, y1: number, x2: number, y2: number) {
  const dx = x1 - x2
  const dy = y1 - y2
  return Math.sqrt(dx * dx + dy * dy)
}

export function inBox(
  minX: number,
  minY: number,
  width: number,
  height: number,
  x: number,
  y: number
) {
  return x >= minX && x <= minX + width && y >= minY && y <= minY + height
}

export function inArc(
  cx: number,
  cy: number,
  r: number,
  lineWidth: number,
  x: number,
  y: number
) {
  const angle = (Math.atan2(y - cy, x - cx) + Math.PI * 2) % (Math.PI * 2) // 转换到 0 - 2 * Math.PI 之间
  const point = {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }

  return distance(point.x, point.y, x, y) <= lineWidth / 2
}

export function ellipseDistance(
  squareX: number,
  squareY: number,
  rx: number,
  ry: number
) {
  return squareX / (rx * rx) + squareY / (ry * ry)
}

// https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment/6853926#6853926
export function pointToLineDistance(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const A = x - x1
  const B = y - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) param = dot / lenSq

  let xx
  let yy

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = x - xx
  const dy = y - yy
  return Math.sqrt(dx * dx + dy * dy)
}

export function inLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineWidth: number,
  x: number,
  y: number
) {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  const halfWidth = lineWidth / 2
  if (
    !(
      x >= minX - halfWidth &&
      x <= maxX + halfWidth &&
      y >= minY - halfWidth &&
      y <= maxY + halfWidth
    )
  ) {
    return false
  }
  return pointToLineDistance(x, y, x1, y1, x2, y2) <= lineWidth / 2
}

export function inRectWithRadius(
  minX: number,
  minY: number,
  width: number,
  height: number,
  radiusArray: [number, number, number, number],
  lineWidth: number,
  x: number,
  y: number
) {
  const [tlr, trr, brr, blr] = radiusArray
  return (
    inLine(minX + tlr, minY, minX + width - trr, minY, lineWidth, x, y) ||
    inLine(
      minX + width,
      minY + trr,
      minX + width,
      minY + height - brr,
      lineWidth,
      x,
      y
    ) ||
    inLine(
      minX + width - brr,
      minY + height,
      minX + blr,
      minY + height,
      lineWidth,
      x,
      y
    ) ||
    inLine(minX, minY + height - blr, minX, minY + tlr, lineWidth, x, y) ||
    inArc(minX + width - trr, minY + trr, trr, lineWidth, x, y) ||
    inArc(minX + width - brr, minY + height - brr, brr, 0, x, y) ||
    inArc(minX + blr, minY + height - blr, blr, lineWidth, x, y) ||
    inArc(minX + tlr, minY + tlr, tlr, lineWidth, x, y)
  )
}
