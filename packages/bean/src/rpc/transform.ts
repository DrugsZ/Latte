import type { mat2d, Point } from '../math/matrix'
import type { JsonRpcResponse } from './ipc'

export interface ITransformService {
  /**
   * Starts a transformation session (Request).
   *
   * @param ids - Array of object IDs to be transformed.
   * @returns A promise that resolves when the session has started.
   */
  startSession(ids: number[]): Promise<void>

  /**
   * Updates the transformation (Notification).
   * Note: The '$' suffix indicates a fire-and-forget notification for performance.
   * Sends the total transformation matrix relative to the starting point.
   *
   * @param payload - The transformation data.
   * @param payload.matrix - The 2D transformation matrix.
   * @param payload.origin - The origin point for the transformation.
   */
  updateSession$(payload: { matrix: mat2d; origin: Point }): void

  /**
   * Updates the transformation (Notification).
   * Note: The '$' suffix indicates a fire-and-forget notification for performance.
   * Sends the total transformation matrix relative to the starting point.
   *
   * @param payload - The transformation data.
   * @param payload.matrix - The 2D transformation matrix.
   * @param payload.origin - The origin point for the transformation.
   */
  updateSession(payload: {
    matrix: mat2d
    origin: Point
  }): Promise<JsonRpcResponse>

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
}
