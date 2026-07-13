import { mat2d, vec2 } from 'gl-matrix'

import type { IDType } from '@latte-js/bean'

export interface InteractionGroupTarget {
  readonly id: IDType
  readonly index: number
}

export interface InteractionGroupSize {
  readonly width: number
  readonly height: number
}

export type InteractionGroupBoxMode = 'single-obb' | 'multi-aabb'

export interface InteractionGroupBox<T extends InteractionGroupTarget> {
  readonly ids: readonly IDType[]
  readonly targets: readonly T[]
  readonly matrix: mat2d
  readonly width: number
  readonly height: number
  readonly mode: InteractionGroupBoxMode
}

export interface InteractionGroupResolverOptions<
  T extends InteractionGroupTarget,
> {
  readonly minBoxSize?: number
  readonly getBaseSize: (target: T) => InteractionGroupSize
  readonly getBaseWorldMatrix: (target: T) => mat2d
}

interface WorldBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const DEFAULT_MIN_BOX_SIZE = 1

export class InteractionGroupResolver<
  T extends InteractionGroupTarget = InteractionGroupTarget,
> {
  constructor(private readonly _options: InteractionGroupResolverOptions<T>) {}

  public resolve(targets: readonly T[]): InteractionGroupBox<T> | null {
    if (targets.length === 0) {
      return null
    }

    return targets.length === 1
      ? this._resolveSingleTarget(targets[0], targets)
      : this._resolveMultiTarget(targets)
  }

  private _resolveSingleTarget(
    target: T,
    targets: readonly T[]
  ): InteractionGroupBox<T> | null {
    const size = this._options.getBaseSize(target)
    if (!this._isUsableBoxSize(size.width, size.height)) {
      return null
    }

    return {
      ids: targets.map(item => item.id),
      targets,
      matrix: mat2d.clone(this._options.getBaseWorldMatrix(target)),
      width: size.width,
      height: size.height,
      mode: 'single-obb',
    }
  }

  private _resolveMultiTarget(
    targets: readonly T[]
  ): InteractionGroupBox<T> | null {
    let bounds: WorldBounds | null = null
    const includedTargets: T[] = []

    for (const target of targets) {
      const size = this._options.getBaseSize(target)
      if (!this._isUsableBoxSize(size.width, size.height)) {
        continue
      }

      const targetBounds = this._boundsFromWorldCorners(
        this._options.getBaseWorldMatrix(target),
        size.width,
        size.height
      )
      bounds = bounds ? this._unionBounds(bounds, targetBounds) : targetBounds
      includedTargets.push(target)
    }

    if (!bounds || includedTargets.length === 0) {
      return null
    }

    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    if (!this._isUsableBoxSize(width, height)) {
      return null
    }

    const matrix = mat2d.create()
    mat2d.translate(matrix, matrix, [bounds.minX, bounds.minY])
    return {
      ids: includedTargets.map(item => item.id),
      targets: includedTargets,
      matrix,
      width,
      height,
      mode: 'multi-aabb',
    }
  }

  private _boundsFromWorldCorners(
    world: mat2d,
    width: number,
    height: number
  ): WorldBounds {
    const corners = [
      vec2.fromValues(0, 0),
      vec2.fromValues(width, 0),
      vec2.fromValues(width, height),
      vec2.fromValues(0, height),
    ].map(point => vec2.transformMat2d(point, point, world))
    const xs = corners.map(point => point[0])
    const ys = corners.map(point => point[1])
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    }
  }

  private _unionBounds(a: WorldBounds, b: WorldBounds): WorldBounds {
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
    }
  }

  private _isUsableBoxSize(width: number, height: number) {
    const minBoxSize = this._options.minBoxSize ?? DEFAULT_MIN_BOX_SIZE
    return (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      Math.abs(width) >= minBoxSize &&
      Math.abs(height) >= minBoxSize
    )
  }
}
