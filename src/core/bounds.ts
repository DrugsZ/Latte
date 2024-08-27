import { Vector } from 'Latte/common/vector'
import { Rectangle } from 'Latte/core/rectangle'

const tempVec = Vector.create(0, 0)

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

  addPoint(vec: ReadonlyVec2): void {
    this.minX = Math.min(this.minX, vec[0])
    this.maxX = Math.max(this.maxX, vec[0])
    this.minY = Math.min(this.minY, vec[1])
    this.maxY = Math.max(this.maxY, vec[1])
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

  merge(bound: Bounds) {
    const { minX, minY, maxX, maxY } = bound
    tempVec[0] = minX
    tempVec[1] = minY
    this.addPoint(tempVec)
    tempVec[0] = maxX
    tempVec[1] = maxY
    this.addPoint(tempVec)
  }

  getCenter() {
    if (this.isEmpty()) {
      return { x: 0, y: 0 }
    }
    return {
      x: (this.maxX - this.minX) / 2 + this.minX,
      y: (this.maxY - this.minY) / 2 + this.minY,
    }
  }

  getHalfExtents() {
    return {
      x: (this.maxX - this.minX) / 2,
      y: (this.maxY - this.minY) / 2,
    }
  }
}
