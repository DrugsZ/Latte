import type { ViewModel } from 'Latte/core/viewModel'
import type { ViewMouseModeType } from 'Latte/core/viewMouseMode'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { DisplayObject } from 'Latte/core/displayObject'
import type { EditorMouseEvent } from 'Latte/event/mouseEvent'
import { MouseControllerTarget } from 'Latte/core/activeSelection'
import { CoreNavigationCommands } from 'Latte/core/coreCommands'

export interface IMouseDispatchData {
  target: DisplayObject
  controllerTargetType: MouseControllerTarget
  position: IPoint
  movement: IPoint
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
  public moveElement(element: DisplayObject, movePoint: IPoint) {
    this._viewModel.updateElementData(element.translate(movePoint))
  }
  public rotateElement() {}
  public moveCamera() {}
  public zoomCamera() {}
  public changeViewMouseMove(mode: ViewMouseModeType) {
    this._viewModel.setMouseMode(mode)
  }
  public emitMouseDown() {}

  private _dragSelectionElement(data: IMouseDispatchData) {
    const activeElement = this._viewModel.getActiveSelection()
    this._viewModel.updateElementData(activeElement.translate(data.movement))
  }

  private _createPickArea(data: IMouseDispatchData) {}

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
    const { controllerTargetType } = data
    switch (controllerTargetType) {
      case MouseControllerTarget.SELECTION_CONTEXT:
        this._dragSelectionElement(data)
        break
      case MouseControllerTarget.BLANK:
        this._createPickArea(data)
        break
      default:
        console.error('UnExpect type')
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

  public dispatchMouse(data: IMouseDispatchData) {
    if (data.mouseDownCount === 0) {
    }
    if (data.mouseDownCount === 1) {
      if (data.inSelectionMode) {
        this._dragOnClient(data)
      } else {
        this._mouseDownOnClient(data)
      }
    }
  }

  public tryAdd({ left, top }) {
    const rect = this._viewModel.addChild({ left, top })
  }
}
