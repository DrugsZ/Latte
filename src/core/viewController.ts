import type { ViewModel } from 'Latte/core/viewModel'
import type { ViewMouseModeType } from 'Latte/core/viewMouseMode'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { DisplayObject } from 'Latte/core/displayObject'
import type { EditorMouseEvent } from 'Latte/event/mouseEvent'
import { MouseControllerTarget } from 'Latte/core/activeSelection'

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

export const isLogicTarget = (node?: any): node is DisplayObject => {
  return (
    node instanceof DisplayObject &&
    !(node instanceof Page) &&
    !(node instanceof EditorDocument)
  )
}

export class ViewController {
  constructor(private _viewModel: ViewModel) {}
  public selectElement(target: DisplayObject) {
    if (target instanceof EditorDocument || target instanceof Page) {
      this._viewModel.clearSelection()
      return
    }
    this._viewModel.clearSelection()
    this._viewModel.addSelectElement(target)
  }

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
  public emitMouseDown(e: EditorMouseEvent) {}

  private _dragSelectionElement(data: IMouseDispatchData) {
    const activeElement = this._viewModel.getActiveSelection()
    this._viewModel.updateElementData(activeElement.translate(data.movement))
  }

  private _createPickArea(data: IMouseDispatchData) {}

  private _selectElement(target: DisplayObject, multipleMode: boolean) {
    const activeSelection = this._viewModel.getActiveSelection()
    if (multipleMode) {
      if (activeSelection.hasSelected(target)) {
        this.removeSelectElement(target)
      } else {
        this.addSelectElement(target)
      }
    } else {
      this.selectElement(target)
    }
  }

  public emitMouseUp(event: EditorMouseEvent) {
    const { target, controllerTargetType, shiftKey } = event
    if (!shiftKey) {
      if (isLogicTarget(target)) {
        this._selectElement(target, shiftKey)
      }
    }
  }

  private _dragOnClient(data: IMouseDispatchData) {
    const { controllerTargetType } = data
    switch (controllerTargetType) {
      case MouseControllerTarget.SELECTION_CONTEXT:
        this._dragSelectionElement(data)
        break
      case MouseControllerTarget.BLANK:
        this._createPickArea(data)
        break
    }
  }

  private _mouseDownOnClient(data: IMouseDispatchData) {
    const { target, controllerTargetType, shiftKey } = data
    if (
      !isLogicTarget(target) &&
      controllerTargetType === MouseControllerTarget.BLANK
    ) {
      return this._viewModel.clearSelection()
    }
    switch (controllerTargetType) {
      case MouseControllerTarget.BLANK:
      case MouseControllerTarget.NONE:
        this._selectElement(target, shiftKey)
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
}
