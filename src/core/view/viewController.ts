import type { ViewModel } from 'Latte/core/viweModel/viewModel'
import { Page } from 'Latte/core/elements/page'
import { EditorDocument } from 'Latte/core/elements/document'
import { DisplayObject } from 'Latte/core/elements/displayObject'
import {
  MouseControllerTarget,
  isRotateKey,
  isResizeKey,
} from 'Latte/core/selection/activeSelection'
import {
  CoreNavigationCommands,
  CoreEditingCommands,
} from 'Latte/core/command/coreCommands'
import { OperateMode } from 'Latte/core/cursor/cursor'
import type {
  EditorMouseEvent,
  StandardWheelEvent,
} from 'Latte/core/dom/mouseEvent'
import type { ITextureLoadResult } from 'Latte/core/texture'
import { createDefaultImagePaint } from 'Latte/utils/schema'
import { Container } from 'Latte/core/elements/container'
import { Vector } from 'Latte/utils/vector'

let CACHE_PRE_POINT: vec2 | undefined
let CACHE_START_POINT: vec2 | undefined

export interface IMouseDispatchData {
  target: DisplayObject
  controllerTargetType: MouseControllerTarget
  position: IPoint
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

  private _moveSelectionElement(position: ReadonlyVec2) {
    if (!CACHE_PRE_POINT) {
      return
    }
    const movement = Vector.subtract(position, CACHE_PRE_POINT)
    const newMovement = this._viewModel.onElementWillMove(movement)
    // console.log('movement1', movement[0], movement[1])

    // Vector.add(movement, diff, movement)
    // console.log('movement2', movement)
    const activeElement = this._viewModel.getActiveSelection()
    CoreEditingCommands.MoveElementTo.runCoreEditorCommand(this._viewModel, {
      objects: activeElement.getObjects(),
      position(prevState) {
        return Vector.add(prevState, newMovement)
      },
    })
  }

  private _rotateSelectionElement(position: ReadonlyVec2) {
    if (!CACHE_PRE_POINT) {
      return
    }
    const activeElement = this._viewModel.getActiveSelection()
    const center = activeElement.getCenter()
    const prePoint = Vector.subtract(CACHE_PRE_POINT, center)
    const newPoint = Vector.subtract(position, center)
    const rad =
      Math.atan2(newPoint[1], newPoint[0]) -
      Math.atan2(prePoint[1], prePoint[0])
    CoreEditingCommands.RotateElementTransform.runCoreEditorCommand(
      this._viewModel,
      {
        objects: activeElement.getObjects(),
        rad,
        transformOrigin: center,
      }
    )
  }

  private _resizeElement(key: MouseControllerTarget, position: ReadonlyVec2) {
    CoreEditingCommands.ResizeElement.runCoreEditorCommand(this._viewModel, {
      key,
      position,
    })
  }

  private _createPickArea(endPosition: ReadonlyVec2) {
    CoreNavigationCommands.MouseBoxSelect.runCoreEditorCommand(
      this._viewModel,
      {
        startPosition: CACHE_START_POINT,
        position: endPosition,
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
          startPosition: Vector.create(e.client.x, e.client.y),
          target: e.target,
        })
      }
      this._viewModel.setCursorOperateMode(OperateMode.Edit)
    }
    this._viewModel.onElementMoveEnd()
    CoreNavigationCommands.MouseBoxSelect.runCoreEditorCommand(
      this._viewModel,
      {}
    )
  }

  public emitDrop(files: ITextureLoadResult[], position: IPoint) {
    this._viewModel.getModel().pushStackElement()
    const fi = files.map(item => createDefaultImagePaint(item))
    CoreEditingCommands.CreateNewElement.runCoreEditorCommand(this._viewModel, {
      startPosition: Vector.point2Vec2(position),
      paint: fi,
    })
  }

  private _dragOnClientToEdit(
    position: ReadonlyVec2,
    controllerTargetType: MouseControllerTarget
  ) {
    if (controllerTargetType === MouseControllerTarget.SELECTION_CONTEXT) {
      this._moveSelectionElement(position)
    } else if (isRotateKey(controllerTargetType)) {
      this._rotateSelectionElement(position)
    } else if (isResizeKey(controllerTargetType)) {
      this._resizeElement(controllerTargetType, position)
    } else if (controllerTargetType === MouseControllerTarget.NONE) {
      this._createPickArea(position)
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
      this._dragOnClientToEdit(
        Vector.point2Vec2(data.position),
        data.controllerTargetType
      )
    } else if (editMode === OperateMode.CreateNormalShape) {
      this._createElement({
        startPosition: Vector.point2Vec2(data.startPosition),
        target: data.target,
        position: Vector.point2Vec2(data.position),
      })
    }
    this._viewModel.onElementDidMove()
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
    startPosition?: ReadonlyVec2
    position?: ReadonlyVec2
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
    CACHE_PRE_POINT = Vector.point2Vec2(data.position, CACHE_PRE_POINT)
    CACHE_START_POINT = Vector.point2Vec2(data.startPosition, CACHE_START_POINT)
  }

  public dispatchWheel(event: StandardWheelEvent) {
    // TODO: need to on other file
    const currentCamera = this._viewModel.getCamera()
    const { deltaY, deltaX, client } = event
    if (!event.ctrlKey && !event.metaKey) {
      currentCamera.move(deltaX, deltaY)
      return
    }

    const zoom = currentCamera.getZoom()
    const step = (0.04 * event.speed) / 100

    currentCamera.setZoom(zoom / (1 + step), Vector.create(client.x, client.y))
  }
}
