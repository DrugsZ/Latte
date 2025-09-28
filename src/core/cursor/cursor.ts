import type { MouseControllerTarget } from 'Latte/core/selection/activeSelection'
import type { DisplayObject } from 'Latte/core/elements/displayObject'
import type { ViewModelEventDispatcher } from 'Latte/utils/viewModelEventDispatcher'
import * as viewEvents from 'Latte/core/viewParts/base/viewEvents'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { Bounds } from 'Latte/core/bounds'
import { Emitter } from 'Latte/utils/event'
import { AdsorptionResolver } from 'Latte/core/cursor/cursorAbsorptionLine'
import type { ElementAdsorptionRecord } from 'Latte/core/cursor/cursorAbsorptionLine'
import { create } from 'Latte/utils/vector'

import { registerAPI } from 'Latte/api'

import type { ICursorState } from 'Latte/core/cursor/cursorState'
import { CursorStateAccessor } from 'Latte/core/cursor/cursorState'

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

export const cacheMovement = create(0, 0)

export class Cursor {
  private _hoverControllerKey: MouseControllerTarget
  private _hoverObject: DisplayObject | null
  private _mode: OperateMode = OperateMode.Edit
  private _createType: CursorCreateType = EditorElementTypeKind.RECTANGLE
  private _selectBounds: Bounds = new Bounds()

  private readonly _adsorptionResolver = new AdsorptionResolver(this)

  private readonly _onDidCursorOperateModeChange = new Emitter<OperateMode>()
  public readonly onDidCursorOperateModeChange =
    this._onDidCursorOperateModeChange.event
  private _isXAdsorbing = false
  private _isYAdsorbing = false

  private _stateAccessor = new CursorStateAccessor()
  public readonly onCursorStateChange = this._stateAccessor.onCursorStateChange
  constructor() {
    registerAPI('onDidOperateModeChange', this.onDidCursorOperateModeChange)
  }

  private _listenCursorStateChange = (state: ICursorState) => {}

  setState(state: Partial<ICursorState>) {
    this._stateAccessor.setState(state)
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

  public onElementDidMove = (curs: ReadonlyVec2[]) =>
    this._adsorptionResolver.onElementDidMove(curs)

  public onElementMoveEnd = (curs: ReadonlyVec2[]) =>
    this._adsorptionResolver.onElementMoveEnd(curs)

  public onElementWillMove(
    vecs: ElementAdsorptionRecord[],
    curs: ReadonlyVec2[],
    movement: ReadonlyVec2
  ) {
    return this._adsorptionResolver.onElementWillMove(vecs, curs, movement)
  }
}
