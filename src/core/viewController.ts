import type { ViewModel } from 'Latte/core/viewModel'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { DisplayObject } from 'Latte/core/displayObject'
import {
  MouseControllerTarget,
  isRotateKey,
  isResizeKey,
  isResizeXAxisKey,
  isResizeYAxisKey,
} from 'Latte/core/activeSelection'
import { CoreNavigationCommands } from 'Latte/core/coreCommands'
import { OperateMode } from 'Latte/core/cursor'

import { Point } from 'Latte/common/Point'
import { Matrix } from 'Latte/math/matrix'

const subtract = (a: IPoint, b: IPoint) => new Point(a.x - b.x, a.y - b.y)

export interface IMouseDispatchData {
  target: DisplayObject
  controllerTargetType: MouseControllerTarget
  position: IPoint
  prePosition: IPoint | null
  startPosition: IPoint | null
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
    CoreNavigationCommands.SetElementTransform.runCoreEditorCommand(
      this._viewModel,
      {
        objects: activeElement.getObjects(),
        rad,
        transformOrigin: center,
      }
    )
  }

  private __resizeElement(
    key: MouseControllerTarget,
    position: IPoint,
    prePosition?: IPoint | null
  ) {
    if (!prePosition) {
      return
    }
    const viewModel = this._viewModel
    const activeElement = this._viewModel.getActiveSelection()

    // handleInvertPos

    const {
      x: selectBoxTLX,
      y: selectBoxTLY,
      transform: selectBoxTransform,
    } = activeElement.OBB
    const invertTransform = Matrix.invert({
      ...selectBoxTransform,
      tx: 0,
      ty: 0,
    }) as Matrix

    // getSymbol
    const invertTranPos = Matrix.apply(
      {
        x: position.x - selectBoxTLX,
        y: position.y - selectBoxTLY,
      },
      invertTransform
    )

    const invertTranPrePos = Matrix.apply(
      {
        x: prePosition.x - selectBoxTLX,
        y: prePosition.y - selectBoxTLY,
      },
      invertTransform
    )

    const centerPos = new Point(
      activeElement.OBB.width / 2,
      activeElement.OBB.height / 2
    )

    const symbol = new Point(
      invertTranPos.x > centerPos.x ? 1 : -1,
      invertTranPos.y > centerPos.y ? 1 : -1
    )

    const distance = subtract(invertTranPrePos, invertTranPos)
    if (isResizeXAxisKey(key)) {
      distance.y = 0
    }
    if (isResizeYAxisKey(key)) {
      distance.x = 0
    }
    const moveDistance = Matrix.apply(distance, {
      ...selectBoxTransform,
      tx: 0,
      ty: 0,
    })
    const selectBoxRect = activeElement.OBB
    const newSelectBoxRectWidth = selectBoxRect.width - distance.x * symbol.x
    const newSelectBoxRectHeight = selectBoxRect.height - distance.y * symbol.y
    const newXScaleX = 1 - (distance.x * symbol.x) / selectBoxRect.width
    const newXScaleY = 1 - (distance.y * symbol.y) / selectBoxRect.height
    const newSelectBoxTLX =
      symbol.x === 1 ? selectBoxTLX : selectBoxTLX - moveDistance.x
    const newSelectBoxTLY =
      symbol.y === 1 ? selectBoxTLY : selectBoxTLY - moveDistance.y

    const tempMatrix = new Matrix()
    const scaleMatrix = new Matrix()
    scaleMatrix.a = newXScaleX
    scaleMatrix.d = newXScaleY

    const objects = activeElement.getObjects()
    const result: Partial<BaseElementSchema>[] = []
    // handlePointChange

    objects.forEach(object => {
      // resize widht
      const { x, y, width, height } = object.OBB

      const pureTransform = {
        ...object.transform,
        tx: 0,
        ty: 0,
      }

      const localTransform = Matrix.multiply(
        pureTransform,
        pureTransform,
        invertTransform
      )

      Matrix.multiply(tempMatrix, localTransform, scaleMatrix)

      const vW = new Point(width, 0)
      const vWT = Matrix.apply(vW, tempMatrix)

      const vH = new Point(0, height)
      const vHT = Matrix.apply(vH, tempMatrix)

      const vXO = new Point(x - selectBoxTLX, y - selectBoxTLY)
      const oxScale = vXO.x / selectBoxRect.width
      const oyScale = vXO.y / selectBoxRect.height
      vXO.x = newSelectBoxTLX + newSelectBoxRectWidth * oxScale
      vXO.y = newSelectBoxTLY + newSelectBoxRectHeight * oyScale

      const vWRad = (Math.atan2(vWT.y - vWT.y, vWT.x - vW.x) * Math.PI) / 180
      console.log(vWRad)
      const vWTM = {
        a: Math.cos(vWRad),
        b: Math.sin(vWRad),
        c: -Math.sin(vWRad),
        d: Math.cos(vWRad),
        tx: 0,
        ty: 0,
      }
      const vHTS = Matrix.apply(vHT, vWTM)
      const vHSkew = (Math.atan2(vHTS.y, 0) * Math.PI) / 180
      const vHTM = {
        a: 1,
        b: 0,
        c: Math.tan(vHSkew),
        d: 1,
        tx: 0,
        ty: 0,
      }
      Matrix.multiply(tempMatrix, vWTM, vHTM)
      result.push({
        guid: object.getGuidKey(),
        size: {
          x: Math.sqrt(vWT.x * vWT.x + vWT.y * vWT.y), // object.OBB.width,
          y: Math.sqrt(vHTS.x * vHTS.x + vHTS.y * vHTS.y), // object.OBB.height,
        },
        transform: {
          ...tempMatrix,
          tx: vXO.x,
          ty: vXO.y,
        },
      })
    })
    viewModel.updateElementData(result)
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
    console.log(1112)
    const { controllerTargetType } = data
    if (controllerTargetType === MouseControllerTarget.SELECTION_CONTEXT) {
      this._moveSelectionElement(data.position, data.prePosition)
    } else if (isRotateKey(controllerTargetType)) {
      this._rotateSelectionElement(data.position, data.prePosition)
    } else if (isResizeKey(controllerTargetType)) {
      this.__resizeElement(
        controllerTargetType,
        data.position,
        data.prePosition
      )
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
