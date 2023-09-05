import { EventTarget } from 'Latte/core/eventTarget'
import { Bounds } from 'Latte/core/bounds'
import type { Container } from 'Latte/core/container'
import type { EditorElementTypeKind } from 'Latte/constants/schema'
import { Matrix } from 'Latte/math/matrix'
import { Point } from 'Latte/common/Point'

const beforeTransformPoint = new Point(0, 0)
const afterTransformPoint = new Point(0, 0)
export abstract class DisplayObject<
  T extends BaseElementSchema = BaseElementSchema
> extends EventTarget {
  type: EditorElementTypeKind

  protected _elementData: T

  parentNode: Container | null = null

  protected _bounds: Bounds = new Bounds()

  constructor(element: T) {
    super()
    this.type = element.type
    this._elementData = element
  }

  private static translate(
    element: DisplayObject,
    point: IPoint
  ): Partial<(typeof element)['_elementData']>[] {
    const { x, y, transform } = element
    const { x: movementX, y: movementY } = point
    return [
      {
        guid: element.getGuidKey(),
        transform: { ...transform, tx: x + movementX, ty: y + movementY },
      },
    ]
  }

  private static resize(
    element: DisplayObject,
    size: {
      width?: number
      height?: number
    }
  ): Partial<(typeof element)['_elementData']>[] | null {
    if (!size) {
      return null
    }
    const { width: newWidth, height: newHight } = size
    const { width, height } = element
    let needUpdate = false
    if (!Number.isNaN(Number(newWidth)) && newWidth !== width) {
      needUpdate = true
    }
    if (!Number.isNaN(Number(newHight)) && newHight !== height) {
      needUpdate = true
    }
    if (!needUpdate) {
      return null
    }
    return [
      {
        guid: element.getGuidKey(),
        size: {
          x: newWidth || width,
          y: newHight || height,
        },
      },
    ]
  }

  get id(): string {
    return JSON.stringify(this._elementData.guid)
  }
  getFills() {
    return this._elementData.fillPaints ?? []
  }

  get zIndex() {
    return this._elementData.parentIndex.position
  }

  get width() {
    return this._elementData.size.x
  }

  get height() {
    return this._elementData.size.y
  }

  get x() {
    return this.transform.tx
  }

  get y() {
    return this.transform.ty
  }

  get visible() {
    return this._elementData.visible
  }

  get transform() {
    return this._elementData.transform
  }

  get OBB(): OBB {
    const { x, y, width, height, transform } = this
    return {
      x,
      y,
      width,
      height,
      transform,
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getBorder(): number | number[] | null {
    return null
  }

  getGuidKey() {
    const { guid } = this._elementData
    return guid
  }

  getBounds() {
    this._bounds.clear()
    const worldMatrix = this.transform
    const x = worldMatrix.tx
    const y = worldMatrix.ty
    const [tx, ty] = Matrix.fromMatrixOrigin([0, 0], worldMatrix, [
      this.x,
      this.y,
    ])
    const tempMatrix = new Matrix(
      worldMatrix.a,
      worldMatrix.b,
      worldMatrix.c,
      worldMatrix.d,
      worldMatrix.tx,
      worldMatrix.ty
    )
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

  public getBoundingClientRect() {
    const bounds = this.getBounds()
    return bounds.getRectangle()
  }

  public setElementData(data: T) {
    this._elementData = data
  }

  public getElementById(id: string) {
    return id === this.id ? this : undefined
  }

  public translate(point: IPoint) {
    return DisplayObject.translate(this, point)
  }

  public resize(size: { width?: number; height?: number }) {
    return DisplayObject.resize(this, size)
  }

  public appendChild() {}

  public removeChild() {}
}
