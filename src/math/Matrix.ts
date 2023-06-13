import { Point } from './Point'

const degrees = 180 / Math.PI

/* eslint-disable no-param-reassign */
export class Matrix {
  public a: number

  public b: number

  public c: number

  public d: number

  public tx: number

  public ty: number

  constructor(a = 0, b = 0, c = 0, d = 0, tx = 0, ty = 0) {
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

  /**
   * we suppose the point is (1,0), the point after rotation is x:ax + cy y:bx + dy =>
   * x:a y:b
   * @param mat the matrix to getRotation
   * @returns number of rotation
   */
  static getRotation(mat: Matrix) {
    return Math.atan2(mat.b, mat.a) * degrees
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
}
