import type { mat2d, vec2 } from '../math/matrix'
import type { IDType } from '../schema/index'

export type ResizeHandleDirection =
  'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface AbsoluteSizeResizeRequest {
  readonly mode?: 'absolute-size'
  readonly width?: number
  readonly height?: number
  readonly anchor?: 'local-origin'
}

export type ResizeRequest =
  | (AbsoluteSizeResizeRequest & { readonly mode: 'absolute-size' })
  | {
      readonly mode: 'handle'
      readonly direction: ResizeHandleDirection
      readonly pointerWorld: vec2
      readonly anchor: 'opposite-handle'
    }

export type RotateRequest =
  | {
      readonly mode: 'absolute'
      readonly angle: number
      readonly space: 'containing-parent'
      readonly pivot: 'each-target-center'
    }
  | {
      readonly mode: 'total-delta'
      readonly angle: number
      readonly space: 'world'
      readonly pivot: 'interaction-group-center'
    }
  | {
      readonly mode: 'total-delta'
      readonly angle: number
      readonly space: 'world'
      readonly pivot: {
        readonly kind: 'world-point'
        readonly point: vec2
      }
    }

export interface BeginTransformRequest {
  readonly ids: IDType[]
  readonly operation: 'move' | 'resize' | 'rotate' | 'transform'
  readonly label?: string
}

export interface TransformGroupBoxSnapshot {
  readonly ids: readonly IDType[]
  readonly width: number
  readonly height: number
  readonly matrix: mat2d
}

export interface BeginTransformResult {
  readonly sessionId: string
  readonly baseRevision: number
  readonly groupBox: TransformGroupBoxSnapshot | null
}

export type TransformUpdateOperation =
  | {
      readonly kind: 'move-by'
      readonly delta: vec2
    }
  | {
      readonly kind: 'move-to'
      readonly position: vec2
    }
  | {
      readonly kind: 'transform-around'
      readonly matrixPayload: mat2d
      readonly pivot: vec2
    }
  | {
      readonly kind: 'rotate'
      readonly request: RotateRequest
    }
  | {
      readonly kind: 'resize'
      readonly request: ResizeRequest
    }

export interface UpdateTransformRequest {
  readonly sessionId?: string
  readonly operation: TransformUpdateOperation
}

export interface ITransformService {
  beginTransform(ids: IDType[], label?: string): Promise<void>

  beginTransform(request: BeginTransformRequest): Promise<BeginTransformResult>

  updateTransform(request: UpdateTransformRequest): Promise<void>

  updateTransform$(request: UpdateTransformRequest): void

  commitTransform(sessionId?: string): Promise<void>

  cancelTransform(sessionId?: string): Promise<void>

  /**
   * Moves the object to the specified position (Request).
   *
   * @param id - The ID of the object to move.
   * @param delta - The delta vector [dx, dy].
   * @returns A promise that resolves when the object is moved.
   */
  moveTo(ids: IDType[], delta: vec2): Promise<void>

  moveTo$(ids: IDType[], delta: vec2): void

  /**
   * Moves the object by the specified world-space delta (Request).
   *
   * During an active transform session, delta is the total offset from the
   * session snapshot. Callers should send the latest target delta, not
   * frame-to-frame increments.
   *
   * @param id - The ID of the object to move.
   * @param delta - The delta vector [dx, dy].
   * @returns A promise that resolves when the object is moved.
   */

  moveBy(ids: IDType[], delta: vec2): Promise<void>

  moveBy$(ids: IDType[], delta: vec2): void

  /**
   * Transforms the object around a pivot point (Request).
   *
   * @param id - The ID of the object to transform.
   * @param matrixPayload - The transformation matrix.
   * @param pivot - The pivot point for the transformation.
   * @returns A promise that resolves when the object is transformed.
   */

  transformAround(
    ids: IDType[],
    matrixPayload: mat2d,
    pivot: vec2
  ): Promise<void>

  transformAround$(ids: IDType[], matrixPayload: mat2d, pivot: vec2): void

  rotate(ids: IDType[], request: RotateRequest): Promise<void>

  rotate$(ids: IDType[], request: RotateRequest): void

  setSize(ids: IDType[], request: AbsoluteSizeResizeRequest): Promise<void>

  setSize$(ids: IDType[], request: AbsoluteSizeResizeRequest): void

  resize(ids: IDType[], request: ResizeRequest): Promise<void>

  resize(ids: IDType[], width: number, height: number): Promise<void>

  resize$(ids: IDType[], request: ResizeRequest): void

  resize$(ids: IDType[], width: number, height: number): void

  resizeByHandle(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ): Promise<void>

  resizeByHandle$(
    ids: IDType[],
    direction: ResizeHandleDirection,
    pointerWorld: vec2
  ): void
}
