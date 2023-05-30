/* eslint-disable no-param-reassign */
export class Rectangle {
  public x: number = 0

  public y: number = 0

  public width: number = 0

  public height: number = 0

  constructor(
    x: string | number = 0,
    y: string | number = 0,
    width: string | number = 0,
    height: string | number = 0
  ) {
    this.x = Number(x)
    this.y = Number(y)
    this.width = Number(width)
    this.height = Number(height)
  }

  get left(): number {
    return this.x
  }

  get right(): number {
    return this.x + this.width
  }

  get top(): number {
    return this.y
  }

  get bottom(): number {
    return this.y + this.height
  }

  static get EMPTY(): Rectangle {
    return new Rectangle(0, 0, 0, 0)
  }

  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.width, this.height)
  }

  copyFrom(rectangle: Rectangle): Rectangle {
    this.x = rectangle.x
    this.y = rectangle.y
    this.width = rectangle.width
    this.height = rectangle.height

    return this
  }

  copyTo(rectangle: Rectangle): Rectangle {
    rectangle.x = this.x
    rectangle.y = this.y
    rectangle.width = this.width
    rectangle.height = this.height

    return rectangle
  }

  contains(x: number, y: number): boolean {
    if (this.width <= 0 || this.height <= 0) {
      return false
    }

    if (x >= this.x && x < this.x + this.width) {
      if (y >= this.y && y < this.y + this.height) {
        return true
      }
    }

    return false
  }
}
