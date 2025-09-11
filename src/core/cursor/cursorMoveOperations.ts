import type { DisplayObject } from 'Latte/core/elements/displayObject'
import { Matrix } from 'Latte/core/utils/matrix'
import type { ISingleEditOperation } from 'Latte/core/model/modelChange'
import { EditOperation } from 'Latte/core/model/modelChange'
import type {
  MouseControllerTarget,
  ActiveSelection,
} from 'Latte/core/selection/activeSelection'
import {
  isResetStartXAxis,
  isResetStartYAxis,
  isResetEndXAxis,
  isResetEndYAxis,
} from 'Latte/core/selection/activeSelection'

import { isFunction } from 'Latte/utils/assert'
import { Vector } from 'Latte/utils/vector'

export class CursorMoveOperations {
  static tempMatrix = new Matrix()
  public static rotate(
    objects: DisplayObject[],
    rad: number,
    transformOrigin?: ReadonlyVec2
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
      const [x, y] = Matrix.fromMatrixOrigin([0, 0], diffMatrix, center)
      diffMatrix.tx = x
      diffMatrix.ty = y
      const newP1 = Matrix.apply(Vector.create(OBB.x, OBB.y), diffMatrix)
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
      ;[diffMatrix.tx, diffMatrix.ty] = newP1
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

  private static _getPointOnSelectBoxAxis(
    selectBoxOBB: OBB,
    point: ReadonlyVec2
  ) {
    const {
      x: selectBoxTLX,
      y: selectBoxTLY,
      transform: selectBoxTransform,
    } = selectBoxOBB

    const invertTransform = this._getInvertSelectBoxTransform(
      selectBoxTransform
    ) as Matrix
    return Matrix.apply(
      Vector.create(point[0] - selectBoxTLX, point[1] - selectBoxTLY),
      invertTransform
    )
  }

  private static _getNewPointOnSelectBoxChange(
    selectBox: ReadonlyVec2,
    selectTL: ReadonlyVec2,
    newSelectBox: ReadonlyVec2,
    newSelectBoxTL: ReadonlyVec2,
    point: ReadonlyVec2
  ) {
    const pointInSelectBox = Vector.subtract(point, selectTL)
    const pointInSelectBoxScale = Vector.divide(pointInSelectBox, selectBox)
    const pointSizeOnNewSelectBox = Vector.dot(
      newSelectBox,
      pointInSelectBoxScale
    )
    return Vector.add(newSelectBoxTL, pointSizeOnNewSelectBox)
  }

  private static _getRectInfoBeforeAndAfter(
    selectOBB: OBB,
    vec: ReadonlyVec2,
    key: MouseControllerTarget
  ) {
    const {
      x: selectBoxTLX,
      y: selectBoxTLY,
      transform: selectBoxTransform,
      width: selectBoxWidth,
      height: selectBoxHeight,
    } = selectOBB
    const oldSelectBoxTL = Vector.create(selectBoxTLX, selectBoxTLY)
    const oldSelectBoxRect = Vector.create(selectBoxWidth, selectBoxHeight)
    const positionOnSelectBox = this._getPointOnSelectBoxAxis(selectOBB, vec)
    const startPoint = Vector.create(0, 0)
    const rbPoint = Vector.create(selectOBB.width, selectOBB.height)
    const newStartPoint = Vector.clone(startPoint)
    const newEndPoint = Vector.clone(rbPoint)
    if (isResetStartXAxis(key)) {
      ;[newStartPoint[0]] = positionOnSelectBox
    }

    if (isResetStartYAxis(key)) {
      ;[, newStartPoint[1]] = positionOnSelectBox
    }

    if (isResetEndXAxis(key)) {
      ;[newEndPoint[0]] = positionOnSelectBox
    }

    if (isResetEndYAxis(key)) {
      ;[, newEndPoint[1]] = positionOnSelectBox
    }

    const newSelectBoxTL = Vector.add(
      oldSelectBoxTL,
      Matrix.apply(newStartPoint, {
        ...selectBoxTransform,
        tx: 0,
        ty: 0,
      })
    )
    const newSelectBoxRect = Vector.subtract(newEndPoint, newStartPoint)
    return {
      oldSelectBoxTL,
      oldSelectBoxRect,
      newSelectBoxTL,
      newSelectBoxRect,
    }
  }

  private static _calculateObjectControlPoints = (
    objectOBB: OBB,
    pointTransformFn: (point: ReadonlyVec2) => ReadonlyVec2,
    selectBoxTransform: IMatrixLike
  ) => {
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
    const originalTopLeftPoint = Vector.create(x, y)
    const originalTopRightPoint = Vector.add(
      originalTopLeftPoint,
      Matrix.apply(Vector.create(width, 0), localTransform)
    )
    const originalBottomLeftVector = Vector.add(
      originalTopLeftPoint,
      Matrix.apply(Vector.create(0, height), localTransform)
    )
    const transformedTopLeftPoint = pointTransformFn(originalTopLeftPoint)
    const transformedTopRightPoint = pointTransformFn(originalTopRightPoint)
    const transformedBottomLeftVector = pointTransformFn(
      originalBottomLeftVector
    )
    const transformedWidthVector = Vector.subtract(
      transformedTopRightPoint,
      transformedTopLeftPoint
    )

    const result = {
      transformedTopLeftPoint,
      transformedTopRightPoint,
      transformedBottomLeftVector,
      transformedWidthVector,
    }
    console.log('result', result)
    return result
  }

  private static _computeGeometryFromTransformedPoints = (
    widthVector: ReadonlyVec2
  ) => {
    const widthVectorAngle = Math.atan2(widthVector[1], widthVector[0])
    return {
      a: Math.cos(widthVectorAngle),
      b: Math.sin(widthVectorAngle),
      c: -Math.sin(widthVectorAngle),
      d: Math.cos(widthVectorAngle),
      tx: 0,
      ty: 0,
    }
  }

  private static _checkFlipVertically = (
    actualHeightVectorAfterSize: ReadonlyVec2,
    actualWidthVectorAfterSize: ReadonlyVec2,
    oldBottomLeftVector: ReadonlyVec2,
    newWidthTransformMatrix: IMatrixLike
  ) => {
    // const widthTransformationResult = Matrix.apply(
    //   oldTopRightVector,
    //   newWidthTransformMatrix
    // )
    // const actualHeightVectorAfterSize = Vector.subtract(
    //   transformedBottomLeftVector,
    //   transformedTopLeftPoint
    // )
    const oldHeightDot = Vector.crossProduct(
      actualWidthVectorAfterSize,
      actualHeightVectorAfterSize
    )
    const newHeightDot = Vector.crossProduct(
      actualWidthVectorAfterSize,
      Matrix.apply(oldBottomLeftVector, newWidthTransformMatrix)
    )
    return oldHeightDot * newHeightDot < 0
  }

  private static __calculateTransformedObjectHeightSkew = (
    heightTransformWorldVector: ReadonlyVec2
  ) => {
    const heightSkewAngle =
      Math.PI / 2 -
      Math.atan2(heightTransformWorldVector[1], heightTransformWorldVector[0])
    return {
      a: 1,
      b: 0,
      c: Math.tan(heightSkewAngle),
      d: 1,
      tx: 0,
      ty: 0,
    }
  }

  private static _updateObjectGeometryAfterResize(
    widthTransform: IMatrixLike,
    heightSkew: IMatrixLike,
    worldTransform: IMatrixLike,
    width: number,
    height: number,
    topLeft: ReadonlyVec2,
    shouldFlipVertically: boolean
  ) {
    Matrix.multiply(this.tempMatrix, widthTransform, heightSkew)
    Matrix.multiply(this.tempMatrix, this.tempMatrix, worldTransform)
    const { a, b, c, d } = this.tempMatrix
    return {
      size: {
        x: width,
        y: height,
      },
      transform: {
        a,
        b,
        c: c * (shouldFlipVertically ? -1 : 1),
        d: d * (shouldFlipVertically ? -1 : 1),
        tx: topLeft[0],
        ty: topLeft[1],
      },
    }
  }

  private static _calculateTransformedObjectGeometry = (
    objectOBB: OBB,
    getNewPoint: (point: ReadonlyVec2) => ReadonlyVec2,
    selectBoxTransform: IMatrixLike
  ): Pick<BaseElementSchema, 'size' | 'transform'> => {
    const { height } = objectOBB

    const {
      transformedTopLeftPoint,
      transformedBottomLeftVector,
      transformedWidthVector,
    } = CursorMoveOperations._calculateObjectControlPoints(
      objectOBB,
      getNewPoint,
      selectBoxTransform
    )
    const newWidthTransformMatrix = this._computeGeometryFromTransformedPoints(
      transformedWidthVector
    )
    const actualHeightVectorAfterSize = Vector.subtract(
      transformedBottomLeftVector,
      transformedTopLeftPoint
    )

    const shouldFlipVertically = this._checkFlipVertically(
      actualHeightVectorAfterSize,
      transformedWidthVector,
      Vector.create(0, height),
      newWidthTransformMatrix
    )
    const newVcInvert = Matrix.invert(newWidthTransformMatrix)
    const heightTransformWorldVector = Matrix.apply(
      actualHeightVectorAfterSize,
      newVcInvert!
    )
    const vcHTM = this.__calculateTransformedObjectHeightSkew(
      heightTransformWorldVector
    )
    Matrix.multiply(this.tempMatrix, newWidthTransformMatrix, vcHTM)
    Matrix.multiply(this.tempMatrix, this.tempMatrix, selectBoxTransform)
    const { a, b, c, d } = this.tempMatrix

    return this._updateObjectGeometryAfterResize(
      newWidthTransformMatrix,
      vcHTM,
      selectBoxTransform,
      Vector.len(transformedWidthVector),
      Math.abs(heightTransformWorldVector[1]),
      transformedTopLeftPoint,
      shouldFlipVertically
    )
  }

  public static resize(
    key: MouseControllerTarget,
    position: ReadonlyVec2,
    activeElement: ActiveSelection
  ) {
    const { transform: selectBoxTransform } = activeElement.OBB

    const {
      oldSelectBoxTL,
      oldSelectBoxRect,
      newSelectBoxTL,
      newSelectBoxRect,
    } = this._getRectInfoBeforeAndAfter(activeElement.OBB, position, key)

    if (
      Math.abs(newSelectBoxRect[0]) < 1 ||
      Math.abs(newSelectBoxRect[1]) < 1
    ) {
      return
    }

    const getNewPoint = (point: ReadonlyVec2) =>
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
          this._calculateTransformedObjectGeometry(
            object.OBB,
            getNewPoint,
            selectBoxTransform
          )
        )
      )
    })
    return result
  }

  public static move(
    newPosition: latte.editor.SetStateAction<ReadonlyVec2>,
    objects: DisplayObject[]
  ) {
    const result: ISingleEditOperation[] = []

    objects.forEach(object => {
      const { x, y, transform } = object
      let tx
      let ty
      if (isFunction(newPosition)) {
        ;[tx, ty] = newPosition([x, y])
      } else {
        ;[tx, ty] = newPosition
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
