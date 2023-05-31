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

  static getScaling(out: [number, number], mat: Matrix) {
    const { a: a1, b: b1, c: c1, d: d1 } = mat
    out[0] = Math.sqrt(a1 * a1 + c1 * c1)
    out[1] = Math.sqrt(b1 * b1 + d1 * d1)
    return out
  }

  static getTranslation(out: [number, number], mat: Matrix) {
    out[0] = mat.tx
    out[1] = mat.ty
    return out
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

  /**
   * Translates the matrix on the x and y.
   * @param x - How much to translate x by
   * @param y - How much to translate y by
   * @returns This matrix. Good for chaining method calls.
   */
  translate(x: number, y: number): this {
    this.tx += x
    this.ty += y

    return this
  }

  /**
   * Applies a scale transformation to the matrix.
   * @param x - The amount to scale horizontally
   * @param y - The amount to scale vertically
   * @returns This matrix. Good for chaining method calls.
   */
  scale(x: number, y: number): this {
    this.a *= x
    this.d *= y
    this.c *= x
    this.b *= y
    this.tx *= x
    this.ty *= y

    return this
  }

  /**
   * Applies a rotation transformation to the matrix.
   * @param angle - The angle in radians.
   * @returns This matrix. Good for chaining method calls.
   */
  rotate(angle: number): this {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const a1 = this.a
    const c1 = this.c
    const tx1 = this.tx

    this.a = a1 * cos - this.b * sin
    this.b = a1 * sin + this.b * cos
    this.c = c1 * cos - this.d * sin
    this.d = c1 * sin + this.d * cos
    this.tx = tx1 * cos - this.ty * sin
    this.ty = tx1 * sin + this.ty * cos

    return this
  }
}
