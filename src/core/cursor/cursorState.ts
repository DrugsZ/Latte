import { Emitter } from 'Latte/common/event'
import { MouseControllerTarget } from 'Latte/core/activeSelection'
import type { DisplayObject } from 'Latte/core/displayObject'
import { EditorElementTypeKind } from 'Latte/constants/schema'

interface IAbsorbPoint {
  x: number[]
  y: number[]
}

export type CursorCreateType =
  | EditorElementTypeKind.RECTANGLE
  | EditorElementTypeKind.ELLIPSE

export enum OperateMode {
  ReadOnly,
  Edit,
  CreateNormalShape,
}

export interface ICursorState {
  adsorptionPoints: IAbsorbPoint
  hoverObject: DisplayObject | null
  hoverControllerKey: MouseControllerTarget
  mode: OperateMode
  createType: CursorCreateType
}

class CursorState {
  private _state: ICursorState = {
    adsorptionPoints: {
      x: [],
      y: [],
    },
    hoverObject: null,
    hoverControllerKey: MouseControllerTarget.BLANK,
    mode: OperateMode.Edit,
    createType: EditorElementTypeKind.RECTANGLE,
  }

  public get state() {
    return this._state
  }

  public equals(state: ICursorState) {
    return (
      this._state.createType === state.createType &&
      this._state.mode === state.mode &&
      this._state.hoverControllerKey === state.hoverControllerKey &&
      Object.is(this._state.hoverObject, state.hoverObject) &&
      Object.is(this._state.adsorptionPoints, state.adsorptionPoints)
    )
  }
}

export class CursorStateAccessor {
  private readonly _onCursorStateChange = new Emitter<ICursorState>()
  public readonly onCursorStateChange = this._onCursorStateChange.event

  private _state: ICursorState = {
    adsorptionPoints: {
      x: [],
      y: [],
    },
    hoverObject: null,
    hoverControllerKey: MouseControllerTarget.BLANK,
    mode: OperateMode.Edit,
    createType: EditorElementTypeKind.RECTANGLE,
  }

  public get state() {
    return this._state
  }

  public setState(state: Partial<ICursorState>) {
    this._state = { ...this._state, ...state }
    this._onCursorStateChange.fire(this._state)
  }
}
