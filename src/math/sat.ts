import {
  Point,
  dotProduct,
  subtract,
  magnitude,
  add,
  normal,
} from 'Latte/common/point'
import { EditorElementTypeKind } from 'Latte/constants'
import type { Bounds } from 'Latte/core/bounds'
import type DisplayObject from 'Latte/core/container'
import type Rect from 'Latte/elements/rect'
import type Ellipse from 'Latte/elements/ellipse'
import { Matrix } from 'Latte/math/matrix'

const DEFAULT_SELECT_BOX_AXIS = [new Point(0, 1), new Point(1, 0)]

const tmp = new Point(0, 0)

function pointCircleCollision(point: IPoint, circle: IPoint, r: number) {
  if (r === 0) return false
  return magnitude(subtract(circle, point)) <= r * r
}

type TrianglePoint = [IPoint, IPoint, IPoint]

class TriangleCircleCollision {
  private static _pointInTriangle(
    point: IPoint,
    triangle: [IPoint, IPoint, IPoint]
  ) {
    // compute vectors & dot products
    const center = new Point()
    center.copyFrom(point)
    const t0 = triangle[0]
    const t1 = triangle[1]
    const t2 = triangle[2]
    const v0 = subtract(t2, t0)
    const v1 = subtract(t1, t0)
    const v2 = subtract(center, t0)
    const dot00 = dotProduct(v0, v0)
    const dot01 = dotProduct(v0, v1)
    const dot02 = dotProduct(v0, v2)
    const dot11 = dotProduct(v1, v1)
    const dot12 = dotProduct(v1, v2)

    // Compute barycentric coordinates
    const b = dot00 * dot11 - dot01 * dot01
    const inv = b === 0 ? 0 : 1 / b
    const u = (dot11 * dot02 - dot01 * dot12) * inv
    const v = (dot00 * dot12 - dot01 * dot02) * inv
    return u >= 0 && v >= 0 && u + v < 1
  }

  private static _lineCircleCollide(
    a: IPoint,
    b: IPoint,
    center: IPoint,
    radius: number,
    nearest?: Point
  ) {
    // check to see if start or end points lie within circle
    if (pointCircleCollision(a, center, radius)) {
      if (nearest) {
        nearest.copyFrom(a)
      }
      return true
    }
    if (pointCircleCollision(b, center, radius)) {
      if (nearest) {
        nearest.copyFrom(b)
      }
      return true
    }

    // vector d
    const d = subtract(b, a)

    // vector lc
    const lc = subtract(center, a)

    // project lc onto d, resulting in vector p
    const dLen2 = magnitude(d) // len2 of d
    const p = new Point(0, 0)
    if (dLen2 > 0) {
      const dp = dotProduct(lc, d) / dLen2
      p.x = d.x * dp
      p.y = d.y * dp
    }

    if (!nearest) nearest = tmp
    nearest = add(a, p)

    // len2 of p
    const pLen2 = magnitude(p)

    // check collision
    return (
      pointCircleCollision(nearest, center, radius) &&
      pLen2 <= dLen2 &&
      dotProduct(p, d) >= 0
    )
  }
  private static _singleTriangleCircleCollision(
    triangle: [IPoint, IPoint, IPoint],
    circle: IPoint,
    radius: number
  ) {
    if (this._pointInTriangle(circle, triangle)) return true
    if (this._lineCircleCollide(triangle[0], triangle[1], circle, radius))
      return true
    if (this._lineCircleCollide(triangle[1], triangle[2], circle, radius))
      return true
    if (this._lineCircleCollide(triangle[2], triangle[0], circle, radius))
      return true
    return false
  }
  public static collision(
    triangles: TrianglePoint | TrianglePoint[],
    circle: IPoint,
    radius: number
  ) {
    const firstElement = triangles[0]
    if (firstElement instanceof Array) {
      return triangles.some(triangle =>
        this._singleTriangleCircleCollision(triangle, circle, radius)
      )
    }
    return this._singleTriangleCircleCollision(
      triangles as TrianglePoint,
      circle,
      radius
    )
  }
}

class Projection {
  constructor(public min: number, public max: number) {}

  overlaps(projection) {
    return this.max > projection.min && projection.max > this.min
  }
}

const project = (axes: IPoint, axis: IPoint[]) => {
  const scalars: number[] = []
  const v = new Point()

  axis.forEach(point => {
    v.copyFrom(point)
    scalars.push(dotProduct(v, axes))
  })
  return new Projection(Math.min(...scalars), Math.max(...scalars))
}

export class SAT {
  public static test(a: Projection, b: Projection): boolean {
    return a.overlaps(b)
  }

  private static _getRectPointFromTopLeft(rect: Rect) {
    const { width, height } = rect
    return [
      new Point(0, 0),
      new Point(width, 0),
      new Point(width, height),
      new Point(0, height),
    ].map(item => Matrix.apply(item, rect.transform))
  }

  private static _getRectangleAxis(rect: Rect) {
    const transformPoint = this._getRectPointFromTopLeft(rect)
    const axesList: IPoint[] = []
    for (let i = 1, len = transformPoint.length; i < len; i++) {
      const edge = subtract(transformPoint[i], transformPoint[i - 1])
      axesList.push(normal(edge))
    }
    return axesList
  }

  private static _getSelectBoxPoint(selectBox: Bounds) {
    const { x, y, width, height } = selectBox.getRectangle()
    return [
      new Point(x, y),
      new Point(x + width, y),
      new Point(x + width, y + height),
      new Point(x, y + height),
    ]
  }

  private static _testRectangle(selectVector: IPoint[], rect: Rect) {
    let projectionSelectBox: Projection
    let projectionTestRect: Projection
    const axes = this._getRectangleAxis(rect).concat(DEFAULT_SELECT_BOX_AXIS)
    const rectVectors = this._getRectPointFromTopLeft(rect)
    let result = true
    axes.forEach(axis => {
      projectionSelectBox = project(axis, selectVector)
      projectionTestRect = project(axis, rectVectors)
      if (!projectionSelectBox.overlaps(projectionTestRect)) {
        result = false
      }
    })
    return result
  }

  private static _transformEllipseToCircle(object: Ellipse) {
    const { width, height, x, y } = object
    const tempMatrix = new Matrix()
    if (width > height) {
      tempMatrix.a = height / width
    } else {
      tempMatrix.d = width / height
    }
    const centerOriginTL = Matrix.apply(
      { x: width / 2, y: height / 2 },
      {
        ...object.transform,
        tx: 0,
        ty: 0,
      }
    )
    centerOriginTL.x += x
    centerOriginTL.y += y
    const newCenter = Matrix.apply(centerOriginTL, tempMatrix)
    Matrix.multiply(tempMatrix, tempMatrix, object.transform)
    tempMatrix.b = 0
    tempMatrix.c = 0
    tempMatrix.tx = 0
    tempMatrix.ty = 0
    return {
      currentMatrix: tempMatrix,
      newCenter,
      radius: Math.min(width, height) / 2,
    }
  }

  private static _testEllipse(selectVector: IPoint[], object: Ellipse) {
    const { currentMatrix, newCenter, radius } =
      this._transformEllipseToCircle(object)
    console.log(currentMatrix, newCenter)
    const [newTL, newTR, newBR, newBL] = selectVector.map(point =>
      Matrix.apply(point, currentMatrix)
    )
    return TriangleCircleCollision.collision(
      [
        [newTL, newTR, newBL],
        [newBR, newTR, newBL],
      ],
      newCenter,
      radius
    )
  }

  public static testObject(box: Bounds, object: DisplayObject) {
    const selectVector = this._getSelectBoxPoint(box)
    let result = false
    switch (object.type) {
      case EditorElementTypeKind.ELLIPSE:
        result = this._testEllipse(selectVector, object)
        console.log(result)
        break
      case EditorElementTypeKind.RECTANGLE:
        result = this._testRectangle(selectVector, object)
        break
    }
    return result
  }

  public static testCollision(
    box: Bounds,
    objects: DisplayObject[]
  ): DisplayObject[] {
    return objects.filter(object => this.testObject(box, object))
  }
}
