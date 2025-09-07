export class Point {
  x = 0
  y = 0

  public static equals(a: IPoint | null, b: IPoint | null): boolean {
    if (!a && !b) {
      return true
    }
    return !!a && !!b && a.x === b.x && a.y === b.y
  }

  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  public clone(): Point {
    return new Point(this.x, this.y)
  }

  public copyFrom(p: IPoint) {
    this.x = p.x
    this.y = p.y
  }

  public equals(other: IPoint): boolean {
    return Point.equals(this, other)
  }
}

export const subtract = (a: IPoint, b: IPoint) =>
  new Point(a.x - b.x, a.y - b.y)
export const dot = (a: IPoint, b: IPoint) => new Point(a.x * b.x, a.y * b.y)
export const add = (a: IPoint, b: IPoint) => new Point(a.x + b.x, a.y + b.y)
export const divide = (a: IPoint, b: IPoint) => new Point(a.x / b.x, a.y / b.y)

export const dotProduct = (a: IPoint, b: IPoint) => a.x * b.x + a.y * b.y

export const crossProduct = (a: IPoint, b: IPoint) => a.x * b.y - b.x * a.y

export const magnitude = (point: IPoint) =>
  point.x * point.x + point.y * point.y

export const len = (point: IPoint) => Math.sqrt(magnitude(point))

export const edge = (point: IPoint) => new Point(-point.y, point.x)

export const normal = (point: IPoint) => {
  const p = new Point(0, 0)
  const m = len(point)
  if (m !== 0) {
    p.x = point.x / m
    p.y = point.y / m
  }
  return p
}
