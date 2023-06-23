import { Matrix } from 'Latte/math/Matrix'
import { Point } from 'Latte/math/Point'

export class Transform {
  private _localTransform: Matrix
  private _worldTransform: Matrix
  private _position: Point = new Point(0, 0)
  private _scale: Point = new Point(0, 0)
  private _rotation: number = 0
  private _localPosition: Point = new Point(0, 0)
  private _localScale: Point = new Point(0, 0)
  private _localRotation: number = 0
  localDirty: boolean = false
  worldDirty: boolean = false

  constructor(transform: {
    a: number
    b: number
    c: number
    d: number
    tx: number
    ty: number
  }) {
    const { a, b, c, d, tx, ty } = transform
    this._localTransform = new Matrix(a, b, c, d, tx, ty)
    this._worldTransform = new Matrix(a, b, c, d, tx, ty)
    this.decomposeMatrix()
  }

  decomposeMatrix() {
    this._localPosition = Matrix.getTranslation(this._localTransform)
    this._localScale = Matrix.getScale(this._localTransform)
    this._localRotation = Matrix.getRotation(this._localTransform)
  }

  updateWorldTransform(contextMatrix: Matrix) {
    const localTransform = this.getLocalTransform()
    Matrix.multiply(this._worldTransform, localTransform, contextMatrix)
    this.worldDirty = false
  }

  getWorldTransform(): Matrix {
    return this._worldTransform
  }

  getLocalTransform(): Matrix {
    if (this.localDirty) {
      this.compose()
      this.localDirty = false
    }
    return this._localTransform
  }

  setLocalTransform(...localTransform: Parameters<Matrix['set']>) {
    this._localTransform.set(...localTransform)
    this.decomposeMatrix()
    this.localDirty = true
  }

  getPosition() {
    return this._localPosition
  }

  setPosition(x, y) {
    this.localDirty = true
    this._localPosition.x = x
    this._localPosition.y = y
  }

  translate(x: number, y: number) {
    this.localDirty = true
    this._localPosition.x += x
    this._localPosition.y += y
  }

  rotate(angle: number) {
    this.localDirty = true
    this._localRotation += angle
  }

  setRotate(angle: number) {
    this.localDirty = true
    this._localRotation = angle
  }

  scale(x: number, y: number) {
    this.localDirty = true
    this._localScale.x += x
    this._localScale.y += y
  }

  setScale(x: number, y: number) {
    this.localDirty = true
    this._localScale.x = x
    this._localScale.y = y
  }

  private compose() {
    const cos = Math.cos(this._localRotation)
    const sin = Math.sin(this._localRotation)

    this._localTransform.a = cos * this._localScale.x
    this._localTransform.b = sin * this._localScale.x
    this._localTransform.c = -sin * this._localScale.y
    this._localTransform.d = cos * this._localScale.y
    this._localTransform.tx = this._position.x
    this._localTransform.ty = this._position.y

    return this._localPosition
  }
}
