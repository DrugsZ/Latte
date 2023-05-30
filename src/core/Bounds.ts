import { Rectangle } from 'Cditor/core//Rectangle'

export class Bounds {
  public minX: number = Infinity

  public minY: number = Infinity

  public maxX: number = -Infinity

  public maxY: number = -Infinity

  constructor() {
    this.minX = Infinity
    this.minY = Infinity
    this.maxX = -Infinity
    this.maxY = -Infinity
  }

  isEmpty(): boolean {
    return this.minX > this.maxX || this.minY > this.maxY
  }

  /** Clears the bounds and resets. */
  clear(): void {
    this.minX = Infinity
    this.minY = Infinity
    this.maxX = -Infinity
    this.maxY = -Infinity
  }

  addPoint(point: IPoint): void {
    this.minX = Math.min(this.minX, point.x)
    this.maxX = Math.max(this.maxX, point.x)
    this.minY = Math.min(this.minY, point.y)
    this.maxY = Math.max(this.maxY, point.y)
  }

  getRectangle() {
    if (this.minX > this.maxX || this.minY > this.maxY) {
      return Rectangle.EMPTY
    }

    const rect = new Rectangle(0, 0, 1, 1)

    rect.x = this.minX
    rect.y = this.minY
    rect.width = this.maxX - this.minX
    rect.height = this.maxY - this.minY

    return rect
  }
}
