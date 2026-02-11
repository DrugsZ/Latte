import { type IDType } from './index'

export interface HitResult {
  nodeId?: IDType
  nodeIndex?: number
}

export interface IMouseEvent {
  readonly browserEvent: MouseEvent
  readonly leftButton: boolean
  readonly middleButton: boolean
  readonly rightButton: boolean
  readonly buttons: number
  readonly detail: number
  readonly offsetX: number
  readonly offsetY: number
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
  readonly timestamp: number
}

export interface ILatteEvent extends IMouseEvent {
  readonly hitResult?: HitResult
}

export interface IMouseWheelEvent extends MouseEvent {
  readonly deltaX: number
  readonly deltaY: number
  readonly deltaZ: number
  readonly deltaMode: number
}
