import type { ViewModel } from 'Latte/core/viewModel'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { DisplayObject } from 'Latte/core/displayObject'
import { MouseControllerTarget } from 'Latte/core/activeSelection'
import { CoreNavigationCommands } from 'Latte/core/coreCommands'
import { OperateMode } from 'Latte/core/cursor'

export interface IMouseDispatchData {
  target: DisplayObject
  controllerTargetType: MouseControllerTarget
  position: IPoint
  startPosition: IPoint | null
  movement: IPoint | null
  inSelectionMode: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  mouseDownCount: number

  leftButton: boolean
  rightButton: boolean
}

export const isLogicTarget = (node?: any): node is DisplayObject =>
  node instanceof DisplayObject &&
  !(node instanceof Page) &&
  !(node instanceof EditorDocument)

export class ViewController {
  constructor(private _viewModel: ViewModel) {}

  public addSelectElement(target: DisplayObject) {
    if (target instanceof DisplayObject) {
      this._viewModel.addSelectElement(target)
    }
  }

  public removeSelectElement(target: DisplayObject) {
    if (target instanceof DisplayObject) {
      this._viewModel.removeSelectElement(target)
    }
  }
  public hoverElement() {}
  public hoverSelectBox() {}
  public resizeElement() {}
  public rotateElement() {}
  public moveCamera() {}
  public zoomCamera() {}
  public emitMouseDown() {}

  private _dragSelectionElement(movement: IPoint) {
    const activeElement = this._viewModel.getActiveSelection()
    CoreNavigationCommands.MoveElement.runCoreEditorCommand(this._viewModel, {
      objects: activeElement.getObjects(),
      movement,
    })
  }

  private _createPickArea() {}

  public setSelectElement(target: DisplayObject, multipleMode?: boolean) {
    CoreNavigationCommands.SetActiveSelection.runCoreEditorCommand(
      this._viewModel,
      {
        target,
        multipleMode,
      }
    )
  }

  public emitMouseUp() {}

  private _dragOnClient(data: IMouseDispatchData) {
    const { target } = data
    if (isLogicTarget(target)) {
      this._dragSelectionElement(data.movement)
    } else {
      this._createPickArea()
    }
  }

  private _mouseDownOnClient(data: IMouseDispatchData) {
    const { target, controllerTargetType, shiftKey } = data
    switch (controllerTargetType) {
      case MouseControllerTarget.BLANK:
      case MouseControllerTarget.NONE:
        this.setSelectElement(target, shiftKey)
        break
      default:
        console.error('UnExpect type')
    }
  }

  private _createElement() {}

  public dispatchMouse(data: IMouseDispatchData) {
    const editMode = this._viewModel.getCursorOperateMode()
    if (data.mouseDownCount === 1) {
      if (data.inSelectionMode) {
        if (editMode === OperateMode.Edit) {
          this._dragOnClient(data)
        }
      } else {
        this._mouseDownOnClient(data)
      }
    } else {
      const { target, controllerTargetType } = data
      this._viewModel.setCursorHoverObject(
        isLogicTarget(target) ? target : null
      )
      this._viewModel.setCursorHoverControllerKey(controllerTargetType)
    }
  }

  public tryAdd({ left, top }) {
    this._viewModel.addChild({ left, top })
  }
}
