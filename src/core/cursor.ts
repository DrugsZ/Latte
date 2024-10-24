import type { MouseControllerTarget } from 'Latte/core/activeSelection'
import type { DisplayObject } from 'Latte/core/displayObject'
import type { ViewModelEventDispatcher } from 'Latte/common/viewModelEventDispatcher'
import * as viewEvents from 'Latte/view/viewEvents'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { Bounds } from 'Latte/core/bounds'
import { Emitter } from 'Latte/common/event'

import { registerAPI } from 'Latte/api'

export enum CursorEditMode {
  Edit,
  Scale,
}

export type CursorCreateType =
  | EditorElementTypeKind.RECTANGLE
  | EditorElementTypeKind.ELLIPSE

export enum OperateMode {
  ReadOnly,
  Edit,
  CreateNormalShape,
}

export class Cursor {
  private _hoverControllerKey: MouseControllerTarget
  private _hoverObject: DisplayObject | null
  private _mode: OperateMode = OperateMode.Edit
  private _createType: CursorCreateType = EditorElementTypeKind.RECTANGLE
  private _selectBounds: Bounds = new Bounds()

  private readonly _onDidCursorOperateModeChange = new Emitter<OperateMode>()
  public readonly onDidCursorOperateModeChange =
    this._onDidCursorOperateModeChange.event
  constructor() {
    registerAPI('onDidOperateModeChange', this.onDidCursorOperateModeChange)
  }
  setHoverObject(
    hoverObject: DisplayObject | null,
    eventDispatcher: ViewModelEventDispatcher
  ) {
    if (Object.is(this._hoverObject, hoverObject)) {
      return
    }
    this._hoverObject = hoverObject
    eventDispatcher.emitViewEvent(
      new viewEvents.ViewHoverObjectChangeEvent(hoverObject)
    )
  }

  getHoverObject() {
    return this._hoverObject
  }

  setControllerTarget(
    key: MouseControllerTarget,
    eventDispatcher: ViewModelEventDispatcher
  ) {
    if (this._hoverControllerKey === key) {
      return
    }
    this._hoverControllerKey = key
    eventDispatcher.emitViewEvent(
      new viewEvents.ViewHoverControllerKeyChangeEvent(key)
    )
  }

  getControllerKey() {
    return this._hoverControllerKey
  }

  getOperateMode() {
    return this._mode
  }

  setOperateMode(mode: OperateMode, eventDispatcher: ViewModelEventDispatcher) {
    if (!Object.values(OperateMode).includes(mode)) {
      return console.error(`'${mode}' is does not exist on type 'OperateMode' `)
    }
    if (this._mode === mode) {
      return
    }
    this._mode = mode
    eventDispatcher.emitViewEvent(
      new viewEvents.ViewCursorOperateModeChange(mode)
    )
    this._onDidCursorOperateModeChange.fire(mode)
  }

  getCreateNormalElementType() {
    return this._createType
  }

  public getBoxSelectBounds() {
    return this._selectBounds
  }

  public setBoxSelectBounds(
    eventDispatcher: ViewModelEventDispatcher,
    points?: ReadonlyVec2[]
  ) {
    this._selectBounds.clear()
    points?.forEach(this._selectBounds.addPoint.bind(this._selectBounds))
    eventDispatcher.emitViewEvent(new viewEvents.ViewCursorMoveEvent(true))
  }
}
