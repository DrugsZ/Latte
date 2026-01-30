
export interface IPoint {
  x: number
  y: number
}

export class Point implements IPoint {
  x = 0
  y = 0

  public static equals(a: IPoint | null | undefined, b: IPoint | null | undefined): boolean {
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
