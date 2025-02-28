import { EventTarget } from 'Latte/core/dom/eventTarget'
import { Bounds } from 'Latte/core/bounds'
import type { Container } from 'Latte/core/elements/container'
import type { EditorElementTypeKind } from 'Latte/constants/schema'
import { Matrix } from 'Latte/core/utils/matrix'
import type { RBushNodeAABB } from 'Latte/core/rTree'
import { rTreeRoot } from 'Latte/core/rTree'
import { Vector } from 'Latte/common/vector'

const beforeTransformPoint = Vector.create(0, 0) // new Point(0, 0)
const afterTransformPoint = Vector.create(0, 0) // new Point(0, 0)

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

  private _OBBPoints: [ReadonlyVec2, ReadonlyVec2, ReadonlyVec2, ReadonlyVec2] =
    [
      Vector.create(0, 0),
      Vector.create(0, 0),
      Vector.create(0, 0),
      Vector.create(0, 0),
    ]

  constructor(element: T) {
    super()
    this.type = element.type
    this._elementData = element
  }

  // private _getLimitValue() {
  //   let minX = Infinity
  //   let maxX = -Infinity
  //   let minY = Infinity
  //   let maxY = -Infinity

  //   this._OBBPoints.forEach(item => {
  //     minX = Math.min(minX, item[0])
  //     maxX = Math.max(maxX, item[0])
  //     minY = Math.min(minY, item[1])
  //     maxY = Math.max(maxY, item[1])
  //   })

  //   return [minX, maxX, minY, maxY]
  // }

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

  get name() {
    return this._elementData.name
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
    beforeTransformPoint[0] = x
    beforeTransformPoint[1] = y
    Vector.clone(beforeTransformPoint, this._OBBPoints[0])
    // tr
    beforeTransformPoint[0] = x + this.width
    Matrix.apply(beforeTransformPoint, tempMatrix, afterTransformPoint)
    Vector.clone(afterTransformPoint, this._OBBPoints[1])
    // br
    beforeTransformPoint[0] = x + this.width
    beforeTransformPoint[1] = y + this.height
    Matrix.apply(beforeTransformPoint, tempMatrix, afterTransformPoint)
    Vector.clone(afterTransformPoint, this._OBBPoints[2])
    // bl
    beforeTransformPoint[0] = x
    beforeTransformPoint[1] = y + this.height
    Matrix.apply(beforeTransformPoint, tempMatrix, afterTransformPoint)
    Vector.clone(afterTransformPoint, this._OBBPoints[3])
    this._OBBPoints.forEach(this._bounds.addPoint, this._bounds)
    // this._getLimitValue()
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

  public getOBBPoints() {
    return this._OBBPoints
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
