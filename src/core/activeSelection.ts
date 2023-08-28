import { DisplayObject } from 'Latte/core/displayObject'
import Rect from 'Latte/elements/rect'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { inBox } from 'Latte/math/inPointerInPath'
import { Matrix } from 'Latte/math/matrix'

const tempMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0,
}

export enum MouseControllerTarget {
  BLANK,
  SELECTION_CONTEXT,
  SELECT_ROTATE_LEFT_TOP,
  SELECT_ROTATE_RIGHT_TOP,
  SELECT_ROTATE_LEFT_BOTTOM,
  SELECT_ROTATE_RIGHT_BOTTOM,
  SELECT_RESIZE_LEFT,
  SELECT_RESIZE_TOP,
  SELECT_RESIZE_RIGHT,
  SELECT_RESIZE_BOTTOM,
  SELECT_RESIZE_LEFT_TOP,
  SELECT_RESIZE_RIGHT_TOP,
  SELECT_RESIZE_LEFT_BOTTOM,
  SELECT_RESIZE_RIGHT_BOTTOM,
}

interface IActiveSelectionControl {
  controllerType: MouseControllerTarget
}

export class ActiveSelection extends Rect implements IActiveSelectionControl {
  objects: DisplayObject[] = []
  private _OBBDirty: boolean = false
  public readonly controllerType: MouseControllerTarget

  constructor() {
    super({
      type: EditorElementTypeKind.RECTANGLE,
      size: {
        x: 0,
        y: 0,
      },
      fillPaints: [{ type: 'SOLID' }],
      transform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 0,
        ty: 0,
      },
    })
    this.controllerType = MouseControllerTarget.SELECTION_CONTEXT
  }

  public addSelectElement(element: DisplayObject) {
    this.objects.push(element)
    this._OBBDirty = true
  }

  public removeSelectElement(element: DisplayObject) {
    this.objects = this.objects.filter(o => o !== element)
    this._OBBDirty = true
  }

  public clear() {
    this.objects = []
    this._OBBDirty = false
    this._bounds.clear()
  }

  public updateOBB() {
    const objects = this.objects
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
    this._elementData.transform = { ...tempMatrix }
    this._elementData.size = {
      x: rect.width,
      y: rect.height,
    }
    this._OBBDirty = false
  }

  get OBB() {
    if (this.objects.length == 1) {
      return this.objects[0].OBB
    }
    if (this._OBBDirty) {
      this.updateOBB()
    }
    return super.OBB
  }

  public hasActive() {
    return !!this.objects.length
  }

  public hasSelected = (element: DisplayObject) =>
    this.objects.includes(element)

  public hitTest(point: IPoint) {
    const { width, height, transform } = this.OBB
    const localPosition = Matrix.applyMatrixInvertToPoint(transform, point)
    if (inBox(0, 0, width, height, localPosition.x, localPosition.y)) {
      return this.controllerType
    }
    return MouseControllerTarget.BLANK
  }

  public override translate(point: IPoint): Partial<BaseElementSchema>[] {
    return this.objects.reduce((pre: Partial<BaseElementSchema>[], cur) => {
      return pre.concat(cur.translate(point))
    }, [])
  }
}
