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

  public copyFrom(p: Point) {
    this.x = p.x
    this.y = p.y
  }

  public equals(other: IPoint): boolean {
    return Point.equals(this, other)
  }
}
