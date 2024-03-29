import type { ViewModel } from 'Latte/core/viewModel'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { DisplayObject } from 'Latte/core/displayObject'
import {
  MouseControllerTarget,
  isRotateKey,
  isResizeKey,
} from 'Latte/core/activeSelection'
import { CoreNavigationCommands } from 'Latte/core/coreCommands'
import { OperateMode } from 'Latte/core/cursor'
import type { EditorMouseEvent } from 'Latte/event/mouseEvent'

export interface IMouseDispatchData {
  target: DisplayObject
  controllerTargetType: MouseControllerTarget
  position: IPoint
  prePosition: IPoint | null
  startPosition?: IPoint
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

  private _moveSelectionElement(position: IPoint, prePosition?: IPoint | null) {
    if (!prePosition) {
      return
    }
    const movement = {
      x: position.x - prePosition.x,
      y: position.y - prePosition.y,
    }
    const activeElement = this._viewModel.getActiveSelection()
    CoreNavigationCommands.MoveElement.runCoreEditorCommand(this._viewModel, {
      objects: activeElement.getObjects(),
      movement,
    })
  }

  private _rotateSelectionElement(
    position: IPoint,
    prePosition?: IPoint | null
  ) {
    if (!prePosition) {
      return
    }
    const activeElement = this._viewModel.getActiveSelection()
    const center = activeElement.getCenter()
    const prePoint = {
      x: prePosition.x - center.x,
      y: prePosition.y - center.y,
    }
    const newPoint = {
      x: position.x - center.x,
      y: position.y - center.y,
    }
    const rad =
      Math.atan2(newPoint.y, newPoint.x) - Math.atan2(prePoint.y, prePoint.x)
    CoreNavigationCommands.RotateElementTransform.runCoreEditorCommand(
      this._viewModel,
      {
        objects: activeElement.getObjects(),
        rad,
        transformOrigin: center,
      }
    )
  }

  private _resizeElement(key: MouseControllerTarget, position: IPoint) {
    CoreNavigationCommands.ResizeElement.runCoreEditorCommand(this._viewModel, {
      key,
      position,
    })
  }

  private _createPickArea(data: IMouseDispatchData) {
    CoreNavigationCommands.MouseBoxSelect.runCoreEditorCommand(
      this._viewModel,
      {
        startPosition: data.startPosition,
        position: data.position,
      }
    )
  }

  public setSelectElement(target: DisplayObject, multipleMode?: boolean) {
    CoreNavigationCommands.SetActiveSelection.runCoreEditorCommand(
      this._viewModel,
      {
        target,
        multipleMode,
      }
    )
  }

  public emitMouseUp(e: EditorMouseEvent) {
    const editMode = this._viewModel.getCursorOperateMode()
    if (editMode === OperateMode.CreateNormalShape) {
      if (!this._viewModel.getActiveSelection().isActive()) {
        this._createElement(e.client)
      }
    }
    this._viewModel.setCursorOperateMode(OperateMode.Edit)
    CoreNavigationCommands.MouseBoxSelect.runCoreEditorCommand(
      this._viewModel,
      {}
    )
  }

  private _dragOnClientToEdit(data: IMouseDispatchData) {
    const { controllerTargetType } = data
    if (controllerTargetType === MouseControllerTarget.SELECTION_CONTEXT) {
      this._moveSelectionElement(data.position, data.prePosition)
    } else if (isRotateKey(controllerTargetType)) {
      this._rotateSelectionElement(data.position, data.prePosition)
    } else if (isResizeKey(controllerTargetType)) {
      this._resizeElement(controllerTargetType, data.position)
    } else if (controllerTargetType === MouseControllerTarget.NONE) {
      this._createPickArea(data)
    }
  }

  private _dragOnClient(data: IMouseDispatchData) {
    const editMode = this._viewModel.getCursorOperateMode()
    if (editMode === OperateMode.ReadOnly) {
      return
    }
    if (editMode === OperateMode.Edit) {
      this._dragOnClientToEdit(data)
    } else if (editMode === OperateMode.CreateNormalShape) {
      this._createElement(data.startPosition, data.position)
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

  private _createElement(startPosition?: IPoint, position?: IPoint): void {
    CoreNavigationCommands.CreateNewElement.runCoreEditorCommand(
      this._viewModel,
      {
        position,
        startPosition,
      }
    )
  }

  public dispatchMouse(data: IMouseDispatchData) {
    if (data.mouseDownCount === 1) {
      if (data.inSelectionMode) {
        this._dragOnClient(data)
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
}
