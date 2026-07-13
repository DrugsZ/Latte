import { type IDType } from './index'

export interface HitResult {
  kind?: 'scene-node' | 'render-layer'
  nodeId?: IDType
  nodeIndex?: number
  layerId?: string
  targetId?: string
  payload?: unknown
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
