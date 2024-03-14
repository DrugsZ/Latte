import type { MouseControllerTarget } from 'Latte/core/activeSelection'
import type { DisplayObject } from 'Latte/core/displayObject'
import type { ViewModelEventDispatcher } from 'Latte/common/viewModelEventDispatcher'
import * as viewEvents from 'Latte/view/viewEvents'
import { EditorElementTypeKind } from 'Latte/constants/schema'

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
  private _mode: OperateMode = OperateMode.CreateNormalShape
  private _createType: CursorCreateType = EditorElementTypeKind.RECTANGLE

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

  getControllerKey(): MouseControllerTarget {
    return this._hoverControllerKey
  }

  getOperateMode() {
    return this._mode
  }

  setOperateMode(mode: OperateMode, eventDispatcher: ViewModelEventDispatcher) {
    if (this._mode === mode) {
      return
    }
    this._mode = mode
    eventDispatcher.emitViewEvent(
      new viewEvents.ViewCursorOperateModeChange(mode)
    )
  }

  getCreateNormalElementType() {
    return this._createType
  }
}
