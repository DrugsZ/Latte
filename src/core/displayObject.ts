import { EventTarget } from 'Latte/core/eventTarget'
import { Bounds } from 'Latte/core/bounds'
import type { Container } from 'Latte/core/container'
import type { EditorElementTypeKind } from 'Latte/constants/schema'
import { Matrix } from 'Latte/math/matrix'
import { Point } from 'Latte/common/Point'
import type { RBushNodeAABB } from 'Latte/core/rTree'
import { rTreeRoot } from 'Latte/core/rTree'

const beforeTransformPoint = new Point(0, 0)
const afterTransformPoint = new Point(0, 0)
export abstract class DisplayObject<
  T extends BaseElementSchema = BaseElementSchema
> extends EventTarget {
  static INACTIVE: boolean = false

  type: EditorElementTypeKind

  protected _elementData: T

  parentNode: Container | null = null

  protected _bounds: Bounds = new Bounds()
  private _boundDirty: boolean = true
  private _inactive: boolean = false
  private _rBushNode: RBushNodeAABB = {
    displayObject: this,
  }

  constructor(element: T) {
    super()
    this.type = element.type
    this._elementData = element
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

  inactive() {
    return this._inactive
  }

  private _updateBounds() {
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
    this._boundDirty = false
  }
  // TODO: use EventService to implements
  private _updateRBush() {
    if (Object.getPrototypeOf(this).constructor.INACTIVE || this.inactive()) {
      return
    }
    rTreeRoot.remove(this._rBushNode)
    const { minX, minY, maxX, maxY } = this._bounds
    this._rBushNode.minX = minX
    this._rBushNode.minY = minY
    this._rBushNode.maxX = maxX
    this._rBushNode.maxY = maxY
    rTreeRoot.load([this._rBushNode])
  }

  getBounds() {
    if (this._boundDirty) {
      this._updateBounds()
      this._updateRBush()
    }
    return this._bounds
  }

  public getBoundingClientRect() {
    const bounds = this.getBounds()
    return bounds.getRectangle()
  }

  public setElementData(data: T) {
    if (!Object.is(this._elementData.transform, data.transform)) {
      this._boundDirty = true
    }
    this._elementData = data
    this.getBounds()
  }

  public getElementById(id: string): DisplayObject | undefined {
    return id === this.id ? this : undefined
  }

  public resize(size: { width?: number; height?: number }) {
    return DisplayObject.resize(this, size)
  }

  public getCenter() {
    return this._bounds.getCenter()
  }

  public getHalfExtents() {
    return this._bounds.getHalfExtents()
  }

  public appendChild() {}

  public removeChild(removeChild: DisplayObject) {}
}
