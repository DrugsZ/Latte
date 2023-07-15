import { EventTarget } from 'Latte/core/EventTarget'
import { Transform } from 'Latte/core/Transform'
import { Bounds } from 'Latte/core/Bounds'
import type { Container } from 'Latte/core//Container'
import type { EditorElementTypeKind } from 'Latte/constants/schema'

export abstract class DisplayObject<
  T extends BaseElementSchema = BaseElementSchema
> extends EventTarget {
  type: EditorElementTypeKind

  private _id: string

  protected _elementData: T

  parentNode: Container | null = null

  transform: Transform

  private _bounds: Bounds = new Bounds()

  private _localBounds: Bounds = new Bounds()

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
  getBoundingClientRect(): Rectangle {
    const { size, transform } = this._elementData
    const { tx: x, ty: y } = transform
    const { x: width, y: height } = size
    return {
      x,
      y,
      width,
      height,
    }
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
}
