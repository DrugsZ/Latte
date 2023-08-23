import type { ViewModel } from 'Latte/core/viewModel'
import type { ViewMouseModeType } from 'Latte/core/viewMouseMode'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { DisplayObject } from 'Latte/core/displayObject'
import type { FormattedPointerEvent } from 'Latte/event/eventBind'

export interface IMouseDispatchData {
  target: DisplayObject
  position: IPoint
  isDrag: boolean
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
  public selectElement() {}
  public hoverElement() {}
  public hoverSelectBox() {}
  public resizeElement() {}
  public moveElement(element: DisplayObject, movePoint: IPoint) {
    this._viewModel.updateElementData(element.translate(element, movePoint))
  }
  public rotateElement() {}
  public moveCamera() {}
  public zoomCamera() {}
  public changeViewMouseMove(mode: ViewMouseModeType) {
    this._viewModel.setMouseMode(mode)
  }
  public emitMouseDown(e: FormattedPointerEvent) {
    const { target } = e
    const activeSelection = this._viewModel.getActiveSelection()
    if (target instanceof EditorDocument || target instanceof Page) {
      this._viewModel.clearSelection()
      return
    }
    if (target instanceof DisplayObject) {
      if (!e.shiftKey) {
        this._viewModel.clearSelection()
        this._viewModel.addSelectElement(target)
        return
      }
      if (activeSelection.hasSelected(target)) {
        this._viewModel.removeSelectElement(target)
      } else {
        this._viewModel.addSelectElement(target)
      }
    }
  }

  public dispatchMouse(data: IMouseDispatchData) {}
}
