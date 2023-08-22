import { DisplayObject } from 'Latte/core/displayObject'
import { Matrix } from 'Latte/math/matrix'
import { EditorElementTypeKind } from 'Latte/constants/schema'

const tempMatrix = new Matrix()

export class ActiveSelection extends DisplayObject {
  private _objects: DisplayObject[] = []
  private _OBBDirty: boolean = false

  constructor() {
    super({
      type: EditorElementTypeKind.RECTANGLE,
      transform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 0,
        ty: 0,
      },
    })
  }

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
      tempMatrix.tx = rect.x
      tempMatrix.ty = rect.y
      this._OBB = {
        ...rect,
        transform: tempMatrix,
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
