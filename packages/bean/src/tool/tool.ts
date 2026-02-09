import type { IMouseEvent } from '../event'

export interface ITool {
  readonly id: string

  activate(): void
  deactivate(): void

  onPointerDown?(e: IMouseEvent): void
  onPointerMove?(e: IMouseEvent): void
  onPointerUp?(e: IMouseEvent): void

  onKeyDown?(e: KeyboardEvent): void
  onKeyUp?(e: KeyboardEvent): void

  onDoubleTap?(e: IMouseEvent): void
}
