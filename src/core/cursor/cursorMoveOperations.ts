import type { DisplayObject } from 'Latte/core/displayObject'
import { Matrix } from 'Latte/math/matrix'
import type { ISingleEditOperation } from 'Latte/core/modelChange'
import { EditOperation } from 'Latte/core/modelChange'
import { Point, subtract, dotProduct, add, divide } from 'Latte/common/Point'
import type {
  MouseControllerTarget,
  ActiveSelection,
} from 'Latte/core/activeSelection'
import {
  isResetStartXAxis,
  isResetStartYAxis,
  isResetEndXAxis,
  isResetEndYAxis,
} from 'Latte/core/activeSelection'

import { isFunction } from 'Latte/utils/assert'

export class CursorMoveOperations {
  static tempMatrix = new Matrix()
  public static rotate(
    objects: DisplayObject[],
    rad: number,
    transformOrigin?: IPoint
  ): ISingleEditOperation[] {
    const result: ISingleEditOperation[] = []

    objects.forEach(object => {
      const center = transformOrigin || object.getCenter()
      const { OBB } = object
      const diffMatrix = {
        a: Math.cos(rad),
        b: Math.sin(rad),
        c: -Math.sin(rad),
        d: Math.cos(rad),
        tx: 0,
        ty: 0,
      }
      const [x, y] = Matrix.fromMatrixOrigin([0, 0], diffMatrix, [
        center.x,
        center.y,
      ])
      diffMatrix.tx = x
      diffMatrix.ty = y
      const newP1 = Matrix.apply(OBB, diffMatrix)
      const { transform } = object
      // how get skewX in transform: first get pureTransform without skewX, eg: removeSkewXTransform
      // second: get skewY transform same as skewX, eg: skewToY
      // third: get removeSkewXTransform invert and use invert transform multiply to skewToY, then
      // skewToY will get skewX skewY matrix, and we just need skewX, so  we set another key to default value without skewX
      const removeSkewXTransform = {
        a: transform.a,
        b: transform.b,
        c: -transform.b,
        d: transform.a,
        tx: transform.tx,
        ty: transform.ty,
      }
      const skewXTransform = {
        a: 1,
        b: 0,
        c: transform.a * transform.c + transform.b * transform.d,
        d: 1,
        tx: 0,
        ty: 0,
      }
      Matrix.multiply(diffMatrix, removeSkewXTransform, diffMatrix)
      Matrix.multiply(diffMatrix, diffMatrix, skewXTransform)
      diffMatrix.tx = newP1.x
      diffMatrix.ty = newP1.y
      result.push(
        EditOperation.update(object.getGuidKey(), {
          transform: { ...diffMatrix },
        })
      )
    })
    return result
  }

  private static _getInvertSelectBoxTransform(selectBoxTransform: IMatrixLike) {
    return Matrix.invert({
      ...selectBoxTransform,
      tx: 0,
      ty: 0,
    })
  }

  private static _getPointOnSelectBoxAxis(selectBoxOBB: OBB, point: IPoint) {
    const {
      x: selectBoxTLX,
      y: selectBoxTLY,
      transform: selectBoxTransform,
    } = selectBoxOBB

    const invertTransform = this._getInvertSelectBoxTransform(
      selectBoxTransform
    ) as Matrix
    return Matrix.apply(
      {
        x: point.x - selectBoxTLX,
        y: point.y - selectBoxTLY,
      },
      invertTransform
    )
  }

  private static _getNewPointOnSelectBoxChange(
    selectBox: IPoint,
    selectTL: IPoint,
    newSelectBox: IPoint,
    newSelectBoxTL: IPoint,
    point: IPoint
  ) {
    const pointInSelectBox = subtract(point, selectTL)
    const pointInSelectBoxScale = divide(pointInSelectBox, selectBox)
    const pointSizeOnNewSelectBox = dotProduct(
      newSelectBox,
      pointInSelectBoxScale
    )
    return add(newSelectBoxTL, pointSizeOnNewSelectBox)
  }

  private static _getRectInfoBeforeAndAfter(
    selectOBB: OBB,
    position: IPoint,
    key: MouseControllerTarget
  ) {
    const {
      x: selectBoxTLX,
      y: selectBoxTLY,
      transform: selectBoxTransform,
      width: selectBoxWidth,
      height: selectBoxHeight,
    } = selectOBB
    const oldSelectBoxTL = new Point(selectBoxTLX, selectBoxTLY)
    const oldSelectBoxRect = new Point(selectBoxWidth, selectBoxHeight)
    const positionOnSelectBox = this._getPointOnSelectBoxAxis(
      selectOBB,
      position
    )
    const startPoint = new Point(0, 0)
    const rbPoint = new Point(selectOBB.width, selectOBB.height)
    const newStartPoint = startPoint.clone()
    const newEndPoint = rbPoint.clone()
    if (isResetStartXAxis(key)) {
      newStartPoint.x = positionOnSelectBox.x
    }

    if (isResetStartYAxis(key)) {
      newStartPoint.y = positionOnSelectBox.y
    }

    if (isResetEndXAxis(key)) {
      newEndPoint.x = positionOnSelectBox.x
    }

    if (isResetEndYAxis(key)) {
      newEndPoint.y = positionOnSelectBox.y
    }

    const newSelectBoxTL = add(
      oldSelectBoxTL,
      Matrix.apply(newStartPoint, {
        ...selectBoxTransform,
        tx: 0,
        ty: 0,
      })
    )
    const newSelectBoxRect = subtract(newEndPoint, newStartPoint)
    return {
      oldSelectBoxTL,
      oldSelectBoxRect,
      newSelectBoxTL,
      newSelectBoxRect,
    }
  }

  private static _getNewOBB = (
    objectOBB: OBB,
    getNewPoint: (point: IPoint) => IPoint,
    selectBoxTransform: IMatrixLike
  ): Pick<BaseElementSchema, 'size' | 'transform'> => {
    const { x, y, width, height, transform } = objectOBB
    const pureTransform = {
      ...transform,
      tx: 0,
      ty: 0,
    }
    const invertTransform = this._getInvertSelectBoxTransform(
      selectBoxTransform
    ) as Matrix
    const localTransform = Matrix.multiply(
      pureTransform,
      pureTransform,
      invertTransform
    )
    const objectTL = new Point(x, y)
    const objectVWidth = add(
      objectTL,
      Matrix.apply(new Point(width, 0), localTransform)
    )
    const objectVHeight = add(
      objectTL,
      Matrix.apply(new Point(0, height), localTransform)
    )
    const newTl = getNewPoint(objectTL)
    const newObjectVWidth = getNewPoint(objectVWidth)
    const newObjectVHeight = getNewPoint(objectVHeight)
    const vcWidth = subtract(newObjectVWidth, newTl)
    const vcWRad = Math.atan2(vcWidth.y, vcWidth.x)
    const vcWTM = {
      a: Math.cos(vcWRad),
      b: Math.sin(vcWRad),
      c: -Math.sin(vcWRad),
      d: Math.cos(vcWRad),
      tx: 0,
      ty: 0,
    }
    const vcHeight = subtract(newObjectVHeight, newTl)
    const newVcInvert = Matrix.invert(vcWTM)
    const vcHTS1 = Matrix.apply(vcHeight, newVcInvert!)
    const vcHSkew = Math.PI / 2 - Math.atan2(vcHTS1.y, vcHTS1.x)
    const vcHTM = {
      a: 1,
      b: 0,
      c: Math.tan(vcHSkew),
      d: 1,
      tx: 0,
      ty: 0,
    }
    Matrix.multiply(this.tempMatrix, vcWTM, vcHTM)
    Matrix.multiply(this.tempMatrix, this.tempMatrix, selectBoxTransform)
    const { a, b, c, d } = this.tempMatrix
    return {
      size: {
        x: Math.sqrt(vcWidth.x * vcWidth.x + vcWidth.y * vcWidth.y),
        y: vcHTS1.y,
      },
      transform: {
        a,
        b,
        c,
        d,
        tx: newTl.x,
        ty: newTl.y,
      },
    }
  }

  public static resize(
    key: MouseControllerTarget,
    position: IPoint,
    activeElement: ActiveSelection
  ) {
    const { transform: selectBoxTransform } = activeElement.OBB

    const {
      oldSelectBoxTL,
      oldSelectBoxRect,
      newSelectBoxTL,
      newSelectBoxRect,
    } = this._getRectInfoBeforeAndAfter(activeElement.OBB, position, key)

    if (Math.abs(newSelectBoxRect.x) < 1 || Math.abs(newSelectBoxRect.y) < 1) {
      return
    }

    const getNewPoint = (point: IPoint) =>
      this._getNewPointOnSelectBoxChange.call(
        this,
        oldSelectBoxRect,
        oldSelectBoxTL,
        newSelectBoxRect,
        newSelectBoxTL,
        point
      )

    const objects = activeElement.getObjects()
    const result: ISingleEditOperation[] = []

    objects.forEach(object => {
      result.push(
        EditOperation.update(
          object.getGuidKey(),
          this._getNewOBB(object.OBB, getNewPoint, selectBoxTransform)
        )
      )
    })
    return result
  }

  public static move(
    newPosition: latte.editor.SetStateAction<IPoint>,
    objects: DisplayObject[]
  ) {
    const result: ISingleEditOperation[] = []

    objects.forEach(object => {
      const { x, y, transform } = object
      let tx
      let ty
      if (isFunction(newPosition)) {
        ;({ x: tx, y: ty } = newPosition({
          x,
          y,
        }))
      } else {
        ;({ x: tx, y: ty } = newPosition)
      }
      result.push(
        EditOperation.update(object.getGuidKey(), {
          transform: { ...transform, tx, ty },
        })
      )
    })
    return result
  }
}
