import type { mat2d, Point, vec2 } from '../math/matrix'
import type { IDType } from '../schema/index'

export interface ITransformService {
  /**
   * Starts a transformation session (Request).
   *
   * @param ids - Array of object IDs to be transformed.
   * @returns A promise that resolves when the session has started.
   */
  startSession(ids: IDType[]): Promise<void>

  /**
   * Commits the session (Request).
   * Cleans up the snapshot and records the changes to the Undo stack.
   *
   * @returns A promise that resolves when the session is committed.
   */
  endSession(): Promise<void>

  /**
   * Aborts the session (Request).
   * Rolls back the data without recording to the Undo stack.
   *
   * @returns A promise that resolves when the session is aborted.
   */
  abortSession(): Promise<void>

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
   * Moves the object by the specified delta (Request).
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
}
