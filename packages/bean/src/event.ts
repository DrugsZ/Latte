import { type IDType } from './index'

export interface HitResult {
  nodeId?: IDType
  nodeIndex?: number
}

export interface LatteEvent {
  // Original event (for preventDefault, etc.)
  originalEvent: PointerEvent | WheelEvent | KeyboardEvent

  // Core: Transformed world coordinates
  x: number
  y: number

  // Auxiliary info
  deltaX?: number
  deltaY?: number
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean

  // Hit result (calculated by Art)
  hitResult?: HitResult
}
