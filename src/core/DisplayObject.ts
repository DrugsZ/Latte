import { EventTarget } from 'Cditor/core/EventTarget'
import { Transform } from 'Cditor/core/Transform'
import { Bounds } from 'Cditor/core/Bounds'
import type { Container } from 'Cditor/core//Container'

export enum EditorElementTypeKind {
  RECTANGLE = 'RECTANGLE',
  ELLIPSE = 'ELLIPSE',
  FRAME = 'FRAME',
  PAGE = 'CANVAS',
  DOCUMENT = 'DOCUMENT',
}

export enum FillType {
  SOLID = 'SOLID',
  GRADIENT_LINEAR = 'GRADIENT_LINEAR',
  GRADIENT_RADIAL = 'GRADIENT_RADIAL',
  GRADIENT_ANGULAR = 'GRADIENT_ANGULAR',
  GRADIENT_DIAMOND = 'GRADIENT_DIAMOND',
  IMAGE = 'IMAGE',
}

export abstract class DisplayObject<
  T extends BaseNodeSchema = BaseNodeSchema
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

  // eslint-disable-next-line class-methods-use-this
  getBorder(): number | number[] | null {
    return null
  }

  getGuidKey() {
    const { guid } = this._elementData
    return JSON.stringify(guid)
  }
}
