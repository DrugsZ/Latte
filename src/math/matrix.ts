import { Point } from 'Latte/common/Point'

const degrees = 180 / Math.PI

/* eslint-disable no-param-reassign */
export class Matrix {
  public a: number

  public b: number

  public c: number

  public d: number

  public tx: number

  public ty: number

  public array: Float32Array | null = null

  constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
    this.a = a
    this.b = b
    this.c = c
    this.d = d
    this.tx = tx
    this.ty = ty
  }

  static multiply(out: Matrix, a: Matrix, b: Matrix) {
    const a0 = a.a
    const a1 = a.b
    const a2 = a.c
    const a3 = a.d
    const a4 = a.tx
    const a5 = a.ty
    const b0 = b.a
    const b1 = b.b
    const b2 = b.c
    const b3 = b.d
    const b4 = b.tx
    const b5 = b.ty
    out.a = a0 * b0 + a2 * b1
    out.b = a1 * b0 + a3 * b1
    out.c = a0 * b2 + a2 * b3
    out.d = a1 * b2 + a3 * b3
    out.tx = a0 * b4 + a2 * b5 + a4
    out.ty = a1 * b4 + a3 * b5 + a5
    return out
  }

  static getScale(mat: Matrix) {
    const { a: a1, b: b1, c: c1, d: d1 } = mat
    return new Point(Math.sqrt(a1 * a1 + c1 * c1), Math.sqrt(b1 * b1 + d1 * d1))
  }

  static getTranslation(mat: Matrix) {
    return new Point(mat.tx, mat.ty)
  }

  static fromMatrixOrigin = (
    out: [number, number],
    matrix: Matrix,
    origin?: [number, number]
  ) => {
    if (origin) {
      const ox = origin[0]
      const oy = origin[1]
      out[0] = ox - (matrix.a * ox + matrix.c * oy)
      out[1] = oy - (matrix.b * ox + matrix.d * oy)
    }

    return out
  }

  static apply<P extends IPoint = Point>(
    pos: IPoint,
    a: Matrix,
    newPos?: P
  ): P {
    newPos = (newPos || new Point()) as P
    newPos.x = a.a * pos.x + a.c * pos.y + a.tx
    newPos.y = a.b * pos.x + a.d * pos.y + a.ty

    return newPos
  }

  /**
   * we suppose the point is (1,0), the point after rotation is x:ax + cy y:bx + dy =>
   * x:a y:b
   * @param mat the matrix to getRotation
   * @returns number of rotation
   */
  static getRotation(mat: Matrix) {
    return Math.atan2(mat.b, mat.a) * degrees
  }

  applyInvertToPoint<P extends IPoint = Point>(pos: IPoint, newPos?: P): P {
    newPos = (newPos || new Point()) as P

    const id = 1 / (this.a * this.d + this.c * -this.b)

    const { x, y } = pos

    newPos.x =
      this.d * id * x +
      -this.c * id * y +
      (this.ty * this.c - this.tx * this.d) * id
    newPos.y =
      this.a * id * y +
      -this.b * id * x +
      (-this.ty * this.a + this.tx * this.b) * id

    return newPos
  }

  invert() {
    const aa = this.a
    const ab = this.b
    const ac = this.c
    const ad = this.d
    const atx = this.tx
    const aty = this.ty

    let det = aa * ad - ab * ac
    if (!det) {
      return null
    }
    det = 1.0 / det
    const out = new Matrix()
    out.a = ad * det
    out.b = -ab * det
    out.c = -ac * det
    out.d = aa * det
    out.tx = (ac * aty - ad * atx) * det
    out.ty = (ab * atx - aa * aty) * det
    return out
  }

  set(
    a: number,
    b: number,
    c: number,
    d: number,
    tx: number,
    ty: number
  ): this {
    this.a = a
    this.b = b
    this.c = c
    this.d = d
    this.tx = tx
    this.ty = ty

    return this
  }

  toArray(out: Float32Array = new Float32Array(6)) {
    if (!this.array) {
      this.array = new Float32Array(6)
    }
    const array = out || this.array

    array[0] = this.a
    array[1] = this.b
    array[2] = this.c
    array[3] = this.d
    array[4] = this.tx
    array[5] = this.ty

    return array
  }

  clone(): Matrix {
    const matrix = new Matrix()

    matrix.a = this.a
    matrix.b = this.b
    matrix.c = this.c
    matrix.d = this.d
    matrix.tx = this.tx
    matrix.ty = this.ty

    return matrix
  }
}
