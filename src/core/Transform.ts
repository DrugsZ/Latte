import { Matrix } from 'Cditor/math/Matrix'

export class Transform {
  private _localTransform: Matrix = new Matrix()
  private _worldTransform: Matrix = new Matrix()

  getWorldTransform(): Matrix {}
}
