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

  private _selectOne(data: IMouseDispatchData) {
    const activeSelection = this._viewModel.getActiveSelection()
    if (activeSelection.hasSelected(data.target)) {
      this.removeSelectElement(data.target)
    } else {
      this.selectElement(data.target)
    }
  }

  private _selectMultiple(data: IMouseDispatchData) {
    const activeSelection = this._viewModel.getActiveSelection()
    if (activeSelection.hasSelected(data.target)) {
      this.removeSelectElement(data.target)
    } else {
      this.addSelectElement(data.target)
    }
  }

  public dispatchMouse(data: IMouseDispatchData) {
    if (!data.target) {
      return
    }
    if (data.mouseDownCount === 0) {
    }
    if (data.mouseDownCount === 1) {
      if (data.inSelectionMode) {
        if (
          data.controllerTargetType === MouseControllerTarget.SELECTION_CONTEXT
        ) {
          this._dragSelectionElement(data)
        } else {
          this._createPickArea(data)
        }
      } else {
        if (data.controllerTargetType !== MouseControllerTarget.BLANK) {
          return
        }
        if (data.shiftKey) {
          this._selectMultiple(data)
        } else {
          this._selectOne(data)
        }
      }
    }
  }
}
