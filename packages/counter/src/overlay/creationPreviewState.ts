import { Emitter } from '@latte-js/kit'

export enum CreationPreviewType {
  Rectangle = 'rectangle',
}

export interface WorldBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export type CreationPreviewState = {
  readonly type: CreationPreviewType.Rectangle
  readonly bounds: WorldBounds
} | null

export class CreationPreviewStore {
  private readonly _onDidChange = new Emitter<CreationPreviewState>()
  public readonly onDidChange = this._onDidChange.event

  private _state: CreationPreviewState = null

  public get state() {
    return this._state
  }

  public set(state: CreationPreviewState) {
    this._state = state
    this._onDidChange.fire(this._state)
  }

  public clear() {
    if (!this._state) {
      return
    }
    this.set(null)
  }
}
