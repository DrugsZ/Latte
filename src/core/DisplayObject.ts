import { EventTarget } from 'Latte/core/EventTarget'
import { Transform } from 'Latte/core/Transform'
import { Bounds } from 'Latte/core/Bounds'
import type { Container } from 'Latte/core//Container'
import type { EditorElementTypeKind } from 'Latte/constants/schema'
import { Matrix } from 'Latte/math/matrix'
import { Point } from 'Latte/common/Point'

const beforeTransformPoint = new Point(0, 0)
const afterTransformPoint = new Point(0, 0)
export abstract class DisplayObject<
  T extends BaseElementSchema = BaseElementSchema
> extends EventTarget {
  type: EditorElementTypeKind

  private _id: string

  protected _elementData: T

  parentNode: Container | null = null

  transform: Transform

  protected _bounds: Bounds = new Bounds()

  protected _localBounds: Bounds = new Bounds()

  constructor(element: T) {
    super()
    this.type = element.type
    this._id = JSON.stringify(element.guid)
    this._elementData = element
    this.transform = new Transform(this._elementData.transform)
  }

  getWorldTransform() {
    if (!this.transform.localDirty && !this.transform.worldDirty) {
      return this.transform.getWorldTransform()
    }
    if (this.transform.worldDirty && this.parentNode) {
      const parentTransform = this.parentNode.getWorldTransform()
      this.transform.updateWorldTransform(parentTransform)
      return this.transform.getWorldTransform()
    }
    return this.transform.getWorldTransform()
  }

  getLocalTransform() {
    return this.transform.getLocalTransform()
  }

  getPosition() {
    return this.transform.getPosition()
  }

  get id(): string {
    return JSON.stringify(this._id)
  }
  getFills() {
    return this._elementData.fillPaints ?? []
  }

  getZIndex() {
    return this._elementData.parentIndex.position
  }

  get width() {
    return this._elementData.size.x
  }

  get height() {
    return this._elementData.size.y
  }

  get x() {
    return this.transform.getPosition().x
  }

  get y() {
    return this.transform.getPosition().y
  }

  get visible() {
    return this._elementData.visible
  }

  // eslint-disable-next-line class-methods-use-this
  getBorder(): number | number[] | null {
    return null
  }

  getGuidKey() {
    const { guid } = this._elementData
    return JSON.stringify(guid)
  }

  getBounds() {
    const worldMatrix = this.getWorldTransform()
    const x = worldMatrix.tx
    const y = worldMatrix.ty
    const [tx, ty] = Matrix.fromMatrixOrigin([0, 0], worldMatrix, [
      this.x,
      this.y,
    ])
    const tempMatrix = worldMatrix.clone()
    tempMatrix.tx = tx
    tempMatrix.ty = ty
    // tl
    beforeTransformPoint.x = x
    beforeTransformPoint.y = y
    this._bounds.addPoint(beforeTransformPoint)
    // tr
    beforeTransformPoint.x = x + this.width
    Matrix.apply(beforeTransformPoint, tempMatrix, afterTransformPoint)
    this._bounds.addPoint(afterTransformPoint)
    // br
    beforeTransformPoint.x = x + this.width
    beforeTransformPoint.y = y + this.height
    Matrix.apply(beforeTransformPoint, tempMatrix, afterTransformPoint)
    this._bounds.addPoint(afterTransformPoint)
    // bl
    beforeTransformPoint.x = x
    beforeTransformPoint.y = y + this.height
    Matrix.apply(beforeTransformPoint, tempMatrix, afterTransformPoint)
    this._bounds.addPoint(afterTransformPoint)

    return this._bounds
  }

  getBoundingClientRect() {
    const bounds = this.getBounds()
    return bounds.getRectangle()
  }
}
