import type { ViewModel } from 'Latte/core/viewModel'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { DisplayObject } from 'Latte/core/displayObject'
import {
  MouseControllerTarget,
  isRotateKey,
  isResizeKey,
} from 'Latte/core/activeSelection'
import {
  CoreNavigationCommands,
  CoreEditingCommands,
} from 'Latte/core/coreCommands'
import { OperateMode } from 'Latte/core/cursor'
import type {
  EditorMouseEvent,
  StandardWheelEvent,
} from 'Latte/event/mouseEvent'
import type { ITextureLoadResult } from 'Latte/core/texture'
import { createDefaultImagePaint } from 'Latte/common/schema'
import { Container } from 'Latte/core/container'
import { add } from 'Latte/common/point'
import { Vector } from 'Latte/common/vector'

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
  browserEvent: MouseEvent
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

  private _moveSelectionElement(position: IPoint, prePosition?: IPoint | null) {
    if (!prePosition) {
      return
    }
    const movement = {
      x: position.x - prePosition.x,
      y: position.y - prePosition.y,
    }
    const activeElement = this._viewModel.getActiveSelection()
    CoreEditingCommands.MoveElementTo.runCoreEditorCommand(this._viewModel, {
      objects: activeElement.getObjects(),
      position(prevState) {
        return add(prevState, movement)
      },
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
    CoreEditingCommands.RotateElementTransform.runCoreEditorCommand(
      this._viewModel,
      {
        objects: activeElement.getObjects(),
        rad,
        transformOrigin: center,
      }
    )
  }

  private _resizeElement(key: MouseControllerTarget, position: IPoint) {
    CoreEditingCommands.ResizeElement.runCoreEditorCommand(this._viewModel, {
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
    this._viewModel.getModel().pushStackElement()
    const editMode = this._viewModel.getCursorOperateMode()
    if (editMode === OperateMode.CreateNormalShape) {
      if (!this._viewModel.getActiveSelection().isActive()) {
        this._createElement({
          startPosition: e.client,
          target: e.target,
        })
      }
      this._viewModel.setCursorOperateMode(OperateMode.Edit)
    }
    CoreNavigationCommands.MouseBoxSelect.runCoreEditorCommand(
      this._viewModel,
      {}
    )
  }

  public emitDrop(files: ITextureLoadResult[], position: IPoint) {
    this._viewModel.getModel().pushStackElement()
    const fi = files.map(item => createDefaultImagePaint(item))
    CoreEditingCommands.CreateNewElement.runCoreEditorCommand(this._viewModel, {
      startPosition: position,
      paint: fi,
    })
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
      const { browserEvent: e } = data
      const newX = e.movementX
      const newY = e.movementY
      const currentCamera = this._viewModel.getCamera()
      const vpMatrix = currentCamera.getViewPortMatrix()
      currentCamera.move(-newX / vpMatrix.a, -newY / vpMatrix.d)
    } else if (editMode === OperateMode.Edit) {
      this._dragOnClientToEdit(data)
    } else if (editMode === OperateMode.CreateNormalShape) {
      this._createElement({
        startPosition: data.startPosition,
        target: data.target,
        position: data.position,
      })
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

  private _createElement(options: {
    startPosition?: IPoint
    position?: IPoint
    target: DisplayObject
  }): void {
    const { startPosition, position, target } = options
    let curTarget: DisplayObject | null = target
    while (!(curTarget instanceof Container)) {
      curTarget = target.parentNode
    }
    if (!curTarget || curTarget instanceof EditorDocument) {
      curTarget = this._viewModel.focusPage
    }
    const lastDisplay = (curTarget as Container).getLast()
    CoreEditingCommands.CreateNewElement.runCoreEditorCommand(this._viewModel, {
      position,
      startPosition,
      parent: JSON.parse(curTarget.id),
      insertAfter: lastDisplay.zIndex,
    })
  }

  public dispatchMouse(data: IMouseDispatchData) {
    if (data.mouseDownCount === 1) {
      if (data.inSelectionMode) {
        this._dragOnClient(data)
      } else {
        this._mouseDownOnClient(data)
      }
    } else {
      const editMode = this._viewModel.getCursorOperateMode()
      if (editMode !== OperateMode.Edit) {
        return
      }
      const { target, controllerTargetType } = data
      this._viewModel.setCursorHoverObject(
        isLogicTarget(target) ? target : null
      )
      this._viewModel.setCursorHoverControllerKey(controllerTargetType)
    }
  }

  public dispatchWheel(event: StandardWheelEvent) {
    const currentCamera = this._viewModel.getCamera()
    const { deltaY, deltaX, client } = event
    if (!event.ctrlKey && !event.metaKey) {
      currentCamera.move(deltaX, deltaY)
      return
    }
    const symbol = deltaY > 0 ? 1 : -1
    const delta = Math.min(Math.max(Math.abs(deltaY) / 4, 1), 16)
    const zoom = currentCamera.getZoom()
    const step = zoom * 0.02
    currentCamera.setZoom(
      zoom + step * delta * symbol,
      Vector.create(client.x, client.y)
    )
  }
}
