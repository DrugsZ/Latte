import { EventTarget } from 'Cditor/core/EventTarget'
import { Transform } from 'Cditor/core/Transform'
import { Bounds } from 'Cditor/core/Bounds'
import type { Container } from 'Cditor/core//Container'
import type { Matrix } from 'Cditor/math/Matrix'

export interface IBaseRenderObject {
  type: string
  x: number
  y: number
  transform: Matrix
  fills: Fill[]
  // stroke: string
  // blendMode: string
}

export abstract class DisplayObject<
  T extends BaseNodeSchema = BaseNodeSchema
> extends EventTarget {
  type: string

  private _id: string

  protected _elementData: T

  parentNode: Container | null = null

  transform: Transform = new Transform()

  private _bounds: Bounds = new Bounds()

  private _localBounds: Bounds = new Bounds()

  constructor(element: T) {
    super()
    this.type = element.type
    this._id = JSON.stringify(element.guid)
    this._elementData = element
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

  abstract render(): IBaseRenderObject

  getFills() {
    return this._elementData.fillPaints ?? []
  }

  getGuidKey() {
    const { guid } = this._elementData
    return JSON.stringify(guid)
  }
}
