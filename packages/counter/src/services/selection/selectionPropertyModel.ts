import {
  NodeCursor,
  NULL_INDEX,
  PositioningContextResolver,
  readNodeFills,
  readNodeStrokes,
  type SceneGraph,
} from '@latte-js/espresso'

import type { IPaint, NodeType } from '@latte-js/bean'
import { NodeType as NodeTypeValue } from '@latte-js/bean'
import type {
  SelectionSnapshot,
  SelectionTargetSnapshot,
} from './selectionModel'

export type SelectionPropertyKey =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'rotation'
  | 'opacity'
  | 'fills'
  | 'strokes'
  | 'strokeWeight'
  | 'cornerRadius'
  | 'visible'
  | 'locked'

export type SelectionPropertyValue<T> =
  | { kind: 'uniform'; value: T }
  | { kind: 'mixed' }
  | { kind: 'partial'; value?: T; supported: number; total: number }
  | { kind: 'unavailable' }

interface SelectionPropertyDescriptor<T> {
  readonly key: SelectionPropertyKey
  supports(target: SelectionTargetSnapshot): boolean
  read(target: SelectionTargetSnapshot): T
  equals(a: T, b: T): boolean
}

type Matrix2d = [number, number, number, number, number, number]

const EPSILON = 1e-4

const GEOMETRY_TYPES = new Set<NodeType>([
  NodeTypeValue.RECTANGLE,
  NodeTypeValue.CIRCLE,
  NodeTypeValue.ELLIPSE,
  NodeTypeValue.POLYGON,
  NodeTypeValue.STAR,
  NodeTypeValue.LINE,
  NodeTypeValue.POLYLINE,
  NodeTypeValue.PATH,
  NodeTypeValue.TEXT,
  NodeTypeValue.FRAME,
  NodeTypeValue.GROUP,
])

const PAINT_TYPES = new Set<NodeType>([
  NodeTypeValue.RECTANGLE,
  NodeTypeValue.CIRCLE,
  NodeTypeValue.ELLIPSE,
  NodeTypeValue.POLYGON,
  NodeTypeValue.STAR,
  NodeTypeValue.LINE,
  NodeTypeValue.POLYLINE,
  NodeTypeValue.PATH,
  NodeTypeValue.TEXT,
  NodeTypeValue.FRAME,
])

const CORNER_RADIUS_TYPES = new Set<NodeType>([
  NodeTypeValue.RECTANGLE,
  NodeTypeValue.FRAME,
])

export class SelectionPropertyModel {
  private readonly _positioning: PositioningContextResolver
  private readonly _cache = new Map<string, SelectionPropertyValue<unknown>>()

  constructor(private readonly _sceneGraph: SceneGraph) {
    this._positioning = new PositioningContextResolver(_sceneGraph)
  }

  public read<K extends SelectionPropertyKey>(
    snapshot: SelectionSnapshot,
    key: K
  ): SelectionPropertyValue<unknown> | null {
    const cacheKey = `${snapshot.selectionVersion}:${snapshot.documentRevision}:${key}`
    const cached = this._cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const value = this._sceneGraph.readConsistent(() => {
      const descriptor = this._getDescriptor(key)
      return this._readDescriptor(snapshot, descriptor)
    })
    if (!value) {
      return null
    }

    this._cache.set(cacheKey, value)
    return value
  }

  private _readDescriptor<T>(
    snapshot: SelectionSnapshot,
    descriptor: SelectionPropertyDescriptor<T>
  ): SelectionPropertyValue<T> {
    const supportedTargets = snapshot.targets.filter(target =>
      descriptor.supports(target)
    )

    if (supportedTargets.length === 0) {
      return { kind: 'unavailable' }
    }

    const values = supportedTargets.map(target => descriptor.read(target))
    const first = values[0]
    const uniform = values.every(value => descriptor.equals(first, value))

    if (supportedTargets.length !== snapshot.targets.length) {
      return uniform
        ? {
            kind: 'partial',
            value: cloneValue(first),
            supported: supportedTargets.length,
            total: snapshot.targets.length,
          }
        : {
            kind: 'partial',
            supported: supportedTargets.length,
            total: snapshot.targets.length,
          }
    }

    return uniform
      ? { kind: 'uniform', value: cloneValue(first) }
      : { kind: 'mixed' }
  }

  private _getDescriptor(
    key: SelectionPropertyKey
  ): SelectionPropertyDescriptor<unknown> {
    switch (key) {
      case 'x':
        return this._numericContextDescriptor('x', matrix => matrix[4])
      case 'y':
        return this._numericContextDescriptor('y', matrix => matrix[5])
      case 'rotation':
        return this._numericContextDescriptor('rotation', matrix =>
          normalizeAngle((Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI)
        )
      case 'width':
        return this._numericDescriptor(
          'width',
          target => this._sceneGraph.size[target.index * 2]
        )
      case 'height':
        return this._numericDescriptor(
          'height',
          target => this._sceneGraph.size[target.index * 2 + 1]
        )
      case 'opacity':
        return this._numericDescriptor(
          'opacity',
          target => this._sceneGraph.opacity[target.index],
          () => true
        )
      case 'strokeWeight':
        return this._numericDescriptor(
          'strokeWeight',
          target => new NodeCursor(this._sceneGraph, target.index).strokeWeight
        )
      case 'visible':
        return this._booleanDescriptor(
          'visible',
          target => this._sceneGraph.visible[target.index] === 1,
          () => true
        )
      case 'locked':
        return this._booleanDescriptor(
          'locked',
          target => this._sceneGraph.locked[target.index] === 1,
          () => true
        )
      case 'fills':
        return this._paintDescriptor('fills', target =>
          readNodeFills(this._sceneGraph, target.index)
        )
      case 'strokes':
        return this._paintDescriptor('strokes', target =>
          readNodeStrokes(this._sceneGraph, target.index)
        )
      case 'cornerRadius':
        return {
          key,
          supports: target => CORNER_RADIUS_TYPES.has(target.type),
          read: target =>
            Array.from(
              new NodeCursor(this._sceneGraph, target.index).cornerRadius
            ),
          equals: deepEqual,
        }
    }
  }

  private _numericDescriptor(
    key: SelectionPropertyKey,
    read: (target: SelectionTargetSnapshot) => number,
    supports: (target: SelectionTargetSnapshot) => boolean = target =>
      GEOMETRY_TYPES.has(target.type)
  ): SelectionPropertyDescriptor<number> {
    return {
      key,
      supports,
      read,
      equals: (a, b) => Math.abs(a - b) <= EPSILON,
    }
  }

  private _numericContextDescriptor(
    key: SelectionPropertyKey,
    read: (matrix: Matrix2d) => number
  ): SelectionPropertyDescriptor<number> {
    return this._numericDescriptor(
      key,
      target => {
        const matrix = this._getContextTransform(target)
        if (!matrix) {
          return Number.NaN
        }
        return read(matrix)
      },
      target =>
        GEOMETRY_TYPES.has(target.type) && !!this._getContextTransform(target)
    )
  }

  private _booleanDescriptor(
    key: SelectionPropertyKey,
    read: (target: SelectionTargetSnapshot) => boolean,
    supports: (target: SelectionTargetSnapshot) => boolean
  ): SelectionPropertyDescriptor<boolean> {
    return {
      key,
      supports,
      read,
      equals: Object.is,
    }
  }

  private _paintDescriptor(
    key: SelectionPropertyKey,
    read: (target: SelectionTargetSnapshot) => IPaint[]
  ): SelectionPropertyDescriptor<IPaint[]> {
    return {
      key,
      supports: target => PAINT_TYPES.has(target.type),
      read,
      equals: deepEqual,
    }
  }

  private _getContextTransform(
    target: SelectionTargetSnapshot
  ): Matrix2d | null {
    const context = this._positioning.resolveByIndex(target.index)
    if (!context) {
      return null
    }

    const nodeWorld = this._readWorldMatrix(target.index)
    const containingWorld =
      context.containingParentIndex === NULL_INDEX
        ? identityMatrix()
        : this._readWorldMatrix(context.containingParentIndex)
    const containingInverse = invertMatrix(containingWorld)
    if (!containingInverse) {
      return null
    }

    return multiplyMatrix(containingInverse, nodeWorld)
  }

  private _readWorldMatrix(index: number): Matrix2d {
    const ptr = index * 6
    return [
      this._sceneGraph.worldMatrix[ptr],
      this._sceneGraph.worldMatrix[ptr + 1],
      this._sceneGraph.worldMatrix[ptr + 2],
      this._sceneGraph.worldMatrix[ptr + 3],
      this._sceneGraph.worldMatrix[ptr + 4],
      this._sceneGraph.worldMatrix[ptr + 5],
    ]
  }
}

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const deepEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)

const normalizeAngle = (angle: number) => {
  if (!Number.isFinite(angle)) {
    return angle
  }
  const normalized = (((angle % 360) + 540) % 360) - 180
  return Object.is(normalized, -0) ? 0 : normalized
}

const identityMatrix = (): Matrix2d => [1, 0, 0, 1, 0, 0]

const invertMatrix = (matrix: Matrix2d): Matrix2d | null => {
  const [a, b, c, d, tx, ty] = matrix
  const det = a * d - b * c
  if (Math.abs(det) <= EPSILON) {
    return null
  }
  const invDet = 1 / det
  return [
    d * invDet,
    -b * invDet,
    -c * invDet,
    a * invDet,
    (c * ty - d * tx) * invDet,
    (b * tx - a * ty) * invDet,
  ]
}

const multiplyMatrix = (a: Matrix2d, b: Matrix2d): Matrix2d => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
]
