import type { DisplayObject } from 'Latte/core/displayObject'
import { Bounds } from 'Latte/core/bounds'
import { Matrix } from 'Latte/math/matrix'

export class ActiveSelection {
  private _elementData
  private _cacheElementData
  private _objects: DisplayObject[] = []
  private _bounds: Bounds = new Bounds()
  private _OBB: {
    x: number
    y: number
    width: number
    height: number
    transform: Matrix
  } | null
  private _OBBDirty: boolean = false

  public addSelectElement(element: DisplayObject) {
    this._objects.push(element)
    this._OBBDirty = true
  }

  public removeSelectElement(element: DisplayObject) {
    this._objects = this._objects.filter(o => o !== element)
    this._OBBDirty = true
  }

  public clear() {
    this._objects = []
    this._OBBDirty = false
    this._bounds.clear()
    this._OBB = null
  }

  _updateOBB() {
    const objects = this._objects
    if (objects.length === 1) {
      this._OBB = objects[0].getOBB()
    } else {
      this._bounds.clear()
      objects.forEach(element => {
        if (!element.visible) {
          return
        }
        const elementBBox = element.getBounds()
        this._bounds.merge(elementBBox)
      })
      const rect = this._bounds.getRectangle()
      this._OBB = {
        ...rect,
        transform: new Matrix(1, 0, 0, 1, rect.x, rect.y),
      }
    }
    this._OBBDirty = false
  }

  public getOBB() {
    if (this._OBBDirty) {
      this._updateOBB()
    }
    return this._OBB
  }

  public hasActive() {
    return !!this._objects.length
  }

  public hasSelected = (element: DisplayObject) =>
    this._objects.includes(element)
}
