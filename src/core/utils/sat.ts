import { EditorElementTypeKind } from 'Latte/constants'
import type { Bounds } from 'Latte/core/bounds'
import type DisplayObject from 'Latte/core/elements/container'
import type Rect from 'Latte/core/elements/rect'
import type Ellipse from 'Latte/core/elements/ellipse'
import { Matrix } from 'Latte/core/utils/matrix'
import { Vector } from 'Latte/common/vector'

const DEFAULT_SELECT_BOX_AXIS = [Vector.create(0, 1), Vector.create(1, 0)]

const tmp = Vector.create(0, 0)

function pointCircleCollision(
  point: ReadonlyVec2,
  circle: ReadonlyVec2,
  r: number
) {
  if (r === 0) return false
  return Vector.magnitude(Vector.subtract(circle, point)) <= r * r
}

type TrianglePoint = [ReadonlyVec2, ReadonlyVec2, ReadonlyVec2]

class TriangleCircleCollision {
  private static _pointInTriangle(
    point: ReadonlyVec2,
    triangle: TrianglePoint
  ) {
    // compute vectors & dot products
    const center = Vector.clone(point)
    const t0 = triangle[0]
    const t1 = triangle[1]
    const t2 = triangle[2]
    const v0 = Vector.subtract(t2, t0)
    const v1 = Vector.subtract(t1, t0)
    const v2 = Vector.subtract(center, t0)
    const dot00 = Vector.dotProduct(v0, v0)
    const dot01 = Vector.dotProduct(v0, v1)
    const dot02 = Vector.dotProduct(v0, v2)
    const dot11 = Vector.dotProduct(v1, v1)
    const dot12 = Vector.dotProduct(v1, v2)

    // Compute barycentric coordinates
    const b = dot00 * dot11 - dot01 * dot01
    const inv = b === 0 ? 0 : 1 / b
    const u = (dot11 * dot02 - dot01 * dot12) * inv
    const v = (dot00 * dot12 - dot01 * dot02) * inv
    return u >= 0 && v >= 0 && u + v < 1
  }

  private static _lineCircleCollide(
    a: ReadonlyVec2,
    b: ReadonlyVec2,
    center: ReadonlyVec2,
    radius: number,
    nearest?: ReadonlyVec2
  ) {
    // check to see if start or end points lie within circle
    if (pointCircleCollision(a, center, radius)) {
      if (nearest) {
        Vector.clone(a, nearest)
      }
      return true
    }
    if (pointCircleCollision(b, center, radius)) {
      if (nearest) {
        nearest = Vector.clone(a, nearest)
      }
      return true
    }

    // vector d
    const d = Vector.subtract(b, a)

    // vector lc
    const lc = Vector.subtract(center, a)

    // project lc onto d, resulting in vector p
    const dLen2 = Vector.magnitude(d) // len2 of d
    const p = Vector.create(0, 0)
    if (dLen2 > 0) {
      const dp = Vector.dotProduct(lc, d) / dLen2
      p[0] = d[0] * dp
      p[1] = d[1] * dp
    }

    if (!nearest) nearest = tmp
    Vector.add(a, p, nearest)

    // len2 of p
    const pLen2 = Vector.magnitude(p)

    // check collision
    return (
      pointCircleCollision(nearest, center, radius) &&
      pLen2 <= dLen2 &&
      Vector.dotProduct(p, d) >= 0
    )
  }
  private static _singleTriangleCircleCollision(
    triangle: TrianglePoint,
    circle: ReadonlyVec2,
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
    circle: ReadonlyVec2,
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

const project = (axes: ReadonlyVec2, axis: ReadonlyVec2[]) => {
  const scalars: number[] = []
  const v = Vector.create(0, 0)

  axis.forEach(point => {
    Vector.clone(point, v)
    scalars.push(Vector.dotProduct(v, axes))
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
      Vector.create(0, 0),
      Vector.create(width, 0),
      Vector.create(width, height),
      Vector.create(0, height),
    ].map(item => Matrix.apply(item, rect.transform))
  }

  private static _getRectangleAxis(rect: Rect) {
    const transformPoint = this._getRectPointFromTopLeft(rect)
    const axesList: ReadonlyVec2[] = []
    for (let i = 1, len = transformPoint.length; i < len; i++) {
      const edge = Vector.subtract(transformPoint[i], transformPoint[i - 1])
      axesList.push(Vector.normal(edge))
    }
    return axesList
  }

  private static _getSelectBoxPoint(selectBox: Bounds) {
    const { x, y, width, height } = selectBox.getRectangle()
    return [
      Vector.create(x, y),
      Vector.create(x + width, y),
      Vector.create(x + width, y + height),
      Vector.create(x, y + height),
    ]
  }

  private static _testRectangle(selectVector: ReadonlyVec2[], rect: Rect) {
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
    const centerOriginTL = Matrix.apply(Vector.create(width / 2, height / 2), {
      ...object.transform,
      tx: 0,
      ty: 0,
    })
    centerOriginTL[0] += x
    centerOriginTL[1] += y
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

  private static _testEllipse(selectVector: ReadonlyVec2[], object: Ellipse) {
    const { currentMatrix, newCenter, radius } =
      this._transformEllipseToCircle(object)
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
