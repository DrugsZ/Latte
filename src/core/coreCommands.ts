import type { ViewModel } from 'Latte/core/viewModel'
import { DisplayObject } from 'Latte/core/displayObject'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { CommandsRegistry } from 'Latte/core/commandsRegistry'
import { Matrix } from 'Latte/math/matrix'
import { Point, subtract, dotProduct, add, divide } from 'Latte/common/Point'
import {
  MouseControllerTarget,
  isResetStartXAxis,
  isResetStartYAxis,
  isResetEndXAxis,
  isResetEndYAxis,
} from 'Latte/core/activeSelection'
import { createDefaultElementSchema } from 'Latte/common/schema'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { rTreeRoot } from 'Latte/core/rTree'
import type { ISingleEditOperation } from 'Latte/core/modelChange'
import { EditOperation } from 'Latte/core/modelChange'

export const isLogicTarget = (node?: any): node is DisplayObject =>
  node instanceof DisplayObject &&
  !(node instanceof Page) &&
  !(node instanceof EditorDocument)

export abstract class Command {
  constructor(public id: string) {}
  public register(): void {
    CommandsRegistry.registerCommand(this.id, args => this.runCommand(args))
  }

  public abstract runCommand(args: any): void | Promise<void>
}

export abstract class CoreEditorCommand<T> {
  constructor(public id: string) {}
  public abstract runCoreEditorCommand(
    viewModel: ViewModel,
    args: Partial<T>
  ): void
}

interface BaseCommandOptions {
  source: 'mouse' | 'keyboard'
}
export namespace CoreNavigationCommands {
  interface SetActiveSelection extends BaseCommandOptions {
    target: DisplayObject
    multipleMode?: boolean
  }

  export const SetActiveSelection =
    new (class extends CoreEditorCommand<SetActiveSelection> {
      constructor() {
        super('setActiveSelection')
      }

      public runCoreEditorCommand(
        viewModel: ViewModel,
        args: Partial<SetActiveSelection>
      ) {
        const { target, multipleMode } = args
        if (!isLogicTarget(target)) {
          return !multipleMode && viewModel.discardActiveSelection()
        }
        const activeSelection = viewModel.getActiveSelection()
        if (multipleMode) {
          if (!activeSelection.hasSelected(target)) {
            viewModel.addSelectElement(target)
          } else {
            viewModel.removeSelectElement(target)
          }
        } else {
          viewModel.discardActiveSelection()
          viewModel.addSelectElement(target)
        }
      }
    })()

  interface MouseBoxSelectCommandOptions extends BaseCommandOptions {
    startPosition?: IPoint
    position?: IPoint
  }

  export const MouseBoxSelect =
    new (class extends CoreEditorCommand<MouseBoxSelectCommandOptions> {
      constructor() {
        super('mouseBoxSelect')
      }

      public runCoreEditorCommand(
        viewModel: ViewModel,
        args: Partial<MouseBoxSelectCommandOptions>
      ): void {
        const { startPosition, position } = args
        if (!startPosition || !position) {
          return viewModel.setBoxSelectBounds()
        }
        viewModel.setBoxSelectBounds([startPosition, position])
        const selectBoxBounds = viewModel.getBoxSelectBounds()
        const { minX, minY, maxX, maxY } = selectBoxBounds
        const selectNode = rTreeRoot.search({ minX, minY, maxX, maxY })
        const displayObjects = selectNode.map(item => item.displayObject)
        viewModel.discardActiveSelection()
        if (displayObjects.length) {
          displayObjects.forEach(viewModel.addSelectElement)
        }
      }
    })()
}

export namespace CoreEditingCommands {
  interface CreateElementCommandOptions extends BaseCommandOptions {
    position: IPoint
    startPosition: IPoint
  }

  export const CreateNewElement =
    new (class extends CoreEditorCommand<CreateElementCommandOptions> {
      constructor() {
        super('createElement')
      }

      private _getCreateResizeKey(position: IPoint, startPosition: IPoint) {
        const { x, y } = startPosition
        const { x: newX, y: newY } = position
        let key = MouseControllerTarget.SELECT_RESIZE_RIGHT_BOTTOM
        if (newY < y) {
          if (newX < x) {
            key = MouseControllerTarget.SELECT_RESIZE_LEFT_TOP
          } else {
            key = MouseControllerTarget.SELECT_RESIZE_RIGHT_TOP
          }
        } else if (newX < x) {
          key = MouseControllerTarget.SELECT_RESIZE_LEFT_BOTTOM
        }
        return key
      }

      private _resizeActiveCreate(
        viewModel: ViewModel,
        position: IPoint,
        startPosition: IPoint
      ) {
        CoreEditingCommands.ResizeElement.runCoreEditorCommand(viewModel, {
          key: this._getCreateResizeKey(position, startPosition),
          position,
        })
      }

      private _createElement(
        viewModel: ViewModel,
        startPosition: IPoint,
        position?: IPoint
      ) {
        const type = viewModel.getCursorCreateElementType()
        let { x: left, y: top } = startPosition
        let size = {}
        if (position) {
          size = { width: 1, height: 1 }
        } else {
          left -= 50
          top -= 50
        }
        let newShapeSchema
        if (type === EditorElementTypeKind.RECTANGLE) {
          newShapeSchema = createDefaultElementSchema({
            left,
            top,
            ...size,
          })
        }
        return newShapeSchema
      }

      public runCoreEditorCommand(
        viewModel: ViewModel,
        args: Partial<CreateElementCommandOptions>
      ): void {
        const { position, startPosition } = args
        if (!startPosition) {
          return
        }
        const activeSelection = viewModel.getActiveSelection()
        if (activeSelection.isActive() && position) {
          this._resizeActiveCreate(viewModel, position, startPosition)
        } else {
          const result: ISingleEditOperation[] = []
          const newShape = this._createElement(
            viewModel,
            startPosition,
            position
          )
          result.push(EditOperation.create(newShape.guid, newShape))
          viewModel.getModel().pushEditOperations(result)
        }
      }
    })()

  interface BaseMoveCommandOptions extends BaseCommandOptions {
    startPosition: IPoint
    position: IPoint
    movement: IPoint
    objects: DisplayObject[]
  }
  export const MoveElement =
    new (class extends CoreEditorCommand<BaseMoveCommandOptions> {
      constructor() {
        super('moveElement')
      }

      public runCoreEditorCommand(
        viewModel: ViewModel,
        args: Partial<BaseMoveCommandOptions>
      ): void {
        const { movement, objects } = args
        if (!objects || !movement) return
        const { x: movementX, y: movementY } = movement
        const result: ISingleEditOperation[] = []

        objects.forEach(object => {
          const { x, y, transform } = object
          result.push(
            EditOperation.update(object.getGuidKey(), {
              transform: { ...transform, tx: x + movementX, ty: y + movementY },
            })
          )
        })
        viewModel.getModel().pushEditOperations(result)
        // viewModel.updateElementData(results)
      }
    })()

  interface RotateElementCommandOptions extends BaseCommandOptions {
    objects: DisplayObject[]
    transformOrigin?: IPoint
    rad: number
  }
  export const RotateElementTransform =
    new (class extends CoreEditorCommand<RotateElementCommandOptions> {
      constructor() {
        super('rotateElement')
      }

      public runCoreEditorCommand(
        viewModel: ViewModel,
        args: Partial<RotateElementCommandOptions>
      ): void {
        const { objects, rad, transformOrigin } = args
        if (!objects || !objects.length || !rad) {
          return
        }
        const result: ISingleEditOperation[] = []

        objects.forEach(object => {
          const center = transformOrigin || object.getCenter()
          const { OBB } = object
          const diffMatrix = {
            a: Math.cos(rad),
            b: Math.sin(rad),
            c: -Math.sin(rad),
            d: Math.cos(rad),
            tx: 0,
            ty: 0,
          }
          const [x, y] = Matrix.fromMatrixOrigin([0, 0], diffMatrix, [
            center.x,
            center.y,
          ])
          diffMatrix.tx = x
          diffMatrix.ty = y
          const newP1 = Matrix.apply(OBB, diffMatrix)
          const { transform } = object
          // how get skewX in transform: first get pureTransform without skewX, eg: removeSkewXTransform
          // second: get skewY transform same as skewX, eg: skewToY
          // third: get removeSkewXTransform invert and use invert transform multiply to skewToY, then
          // skewToY will get skewX skewY matrix, and we just need skewX, so  we set another key to default value without skewX
          const removeSkewXTransform = {
            a: transform.a,
            b: transform.b,
            c: -transform.b,
            d: transform.a,
            tx: transform.tx,
            ty: transform.ty,
          }
          const skewXTransform = {
            a: 1,
            b: 0,
            c: transform.a * transform.c + transform.b * transform.d,
            d: 1,
            tx: 0,
            ty: 0,
          }
          Matrix.multiply(diffMatrix, removeSkewXTransform, diffMatrix)
          Matrix.multiply(diffMatrix, diffMatrix, skewXTransform)
          diffMatrix.tx = newP1.x
          diffMatrix.ty = newP1.y
          result.push(
            EditOperation.update(object.getGuidKey(), {
              transform: { ...diffMatrix },
            })
          )
        })
        viewModel.getModel().pushEditOperations(result)
        // viewModel.updateElementData(results)
      }
    })()

  interface ResizeElementCommandOptions extends BaseCommandOptions {
    key: MouseControllerTarget
    position: IPoint
  }

  class ResizeElementCommand extends CoreEditorCommand<ResizeElementCommandOptions> {
    static tempMatrix = new Matrix()
    constructor() {
      super('resizeElement')
    }

    private _getInvertSelectBoxTransform(selectBoxTransform: IMatrixLike) {
      return Matrix.invert({
        ...selectBoxTransform,
        tx: 0,
        ty: 0,
      })
    }

    private _getPointOnSelectBoxAxis(selectBoxOBB: OBB, point: IPoint) {
      const {
        x: selectBoxTLX,
        y: selectBoxTLY,
        transform: selectBoxTransform,
      } = selectBoxOBB

      const invertTransform = this._getInvertSelectBoxTransform(
        selectBoxTransform
      ) as Matrix
      return Matrix.apply(
        {
          x: point.x - selectBoxTLX,
          y: point.y - selectBoxTLY,
        },
        invertTransform
      )
    }

    private _getNewPointOnSelectBoxChange(
      selectBox: IPoint,
      selectTL: IPoint,
      newSelectBox: IPoint,
      newSelectBoxTL: IPoint,
      point: IPoint
    ) {
      const pointInSelectBox = subtract(point, selectTL)
      const pointInSelectBoxScale = divide(pointInSelectBox, selectBox)
      const pointSizeOnNewSelectBox = dotProduct(
        newSelectBox,
        pointInSelectBoxScale
      )
      return add(newSelectBoxTL, pointSizeOnNewSelectBox)
    }

    private _getRectInfoBeforeAndAfter(
      selectOBB: OBB,
      position: IPoint,
      key: MouseControllerTarget
    ) {
      const {
        x: selectBoxTLX,
        y: selectBoxTLY,
        transform: selectBoxTransform,
        width: selectBoxWidth,
        height: selectBoxHeight,
      } = selectOBB
      const oldSelectBoxTL = new Point(selectBoxTLX, selectBoxTLY)
      const oldSelectBoxRect = new Point(selectBoxWidth, selectBoxHeight)
      const positionOnSelectBox = this._getPointOnSelectBoxAxis(
        selectOBB,
        position
      )
      const startPoint = new Point(0, 0)
      const rbPoint = new Point(selectOBB.width, selectOBB.height)
      const newStartPoint = startPoint.clone()
      const newEndPoint = rbPoint.clone()
      if (isResetStartXAxis(key)) {
        newStartPoint.x = positionOnSelectBox.x
      }

      if (isResetStartYAxis(key)) {
        newStartPoint.y = positionOnSelectBox.y
      }

      if (isResetEndXAxis(key)) {
        newEndPoint.x = positionOnSelectBox.x
      }

      if (isResetEndYAxis(key)) {
        newEndPoint.y = positionOnSelectBox.y
      }

      const newSelectBoxTL = add(
        oldSelectBoxTL,
        Matrix.apply(newStartPoint, {
          ...selectBoxTransform,
          tx: 0,
          ty: 0,
        })
      )
      const newSelectBoxRect = subtract(newEndPoint, newStartPoint)
      return {
        oldSelectBoxTL,
        oldSelectBoxRect,
        newSelectBoxTL,
        newSelectBoxRect,
      }
    }

    private _getNewOBB = (
      objectOBB: OBB,
      getNewPoint: (point: IPoint) => IPoint,
      selectBoxTransform: IMatrixLike
    ): Pick<BaseElementSchema, 'size' | 'transform'> => {
      const { x, y, width, height, transform } = objectOBB
      const pureTransform = {
        ...transform,
        tx: 0,
        ty: 0,
      }
      const invertTransform = this._getInvertSelectBoxTransform(
        selectBoxTransform
      ) as Matrix
      const localTransform = Matrix.multiply(
        pureTransform,
        pureTransform,
        invertTransform
      )
      const objectTL = new Point(x, y)
      const objectVWidth = add(
        objectTL,
        Matrix.apply(new Point(width, 0), localTransform)
      )
      const objectVHeight = add(
        objectTL,
        Matrix.apply(new Point(0, height), localTransform)
      )
      const newTl = getNewPoint(objectTL)
      const newObjectVWidth = getNewPoint(objectVWidth)
      const newObjectVHeight = getNewPoint(objectVHeight)
      const vcWidth = subtract(newObjectVWidth, newTl)
      const vcWRad = Math.atan2(vcWidth.y, vcWidth.x)
      const vcWTM = {
        a: Math.cos(vcWRad),
        b: Math.sin(vcWRad),
        c: -Math.sin(vcWRad),
        d: Math.cos(vcWRad),
        tx: 0,
        ty: 0,
      }
      const vcHeight = subtract(newObjectVHeight, newTl)
      const newVcInvert = Matrix.invert(vcWTM)
      const vcHTS1 = Matrix.apply(vcHeight, newVcInvert!)
      const vcHSkew = Math.PI / 2 - Math.atan2(vcHTS1.y, vcHTS1.x)
      const vcHTM = {
        a: 1,
        b: 0,
        c: Math.tan(vcHSkew),
        d: 1,
        tx: 0,
        ty: 0,
      }
      Matrix.multiply(ResizeElementCommand.tempMatrix, vcWTM, vcHTM)
      Matrix.multiply(
        ResizeElementCommand.tempMatrix,
        ResizeElementCommand.tempMatrix,
        selectBoxTransform
      )
      const { a, b, c, d } = ResizeElementCommand.tempMatrix
      return {
        size: {
          x: Math.sqrt(vcWidth.x * vcWidth.x + vcWidth.y * vcWidth.y),
          y: vcHTS1.y,
        },
        transform: {
          a,
          b,
          c,
          d,
          tx: newTl.x,
          ty: newTl.y,
        },
      }
    }

    public runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<ResizeElementCommandOptions>
    ): void {
      const { position, key } = args
      if (!position || !key) {
        return
      }
      const activeElement = viewModel.getActiveSelection()

      const { transform: selectBoxTransform } = activeElement.OBB

      const {
        oldSelectBoxTL,
        oldSelectBoxRect,
        newSelectBoxTL,
        newSelectBoxRect,
      } = this._getRectInfoBeforeAndAfter(activeElement.OBB, position, key)

      if (
        Math.abs(newSelectBoxRect.x) < 1 ||
        Math.abs(newSelectBoxRect.y) < 1
      ) {
        return
      }

      const getNewPoint = (point: IPoint) =>
        this._getNewPointOnSelectBoxChange.call(
          this,
          oldSelectBoxRect,
          oldSelectBoxTL,
          newSelectBoxRect,
          newSelectBoxTL,
          point
        )

      const objects = activeElement.getObjects()
      const result: ISingleEditOperation[] = []

      objects.forEach(object => {
        result.push(
          EditOperation.update(
            object.getGuidKey(),
            this._getNewOBB(object.OBB, getNewPoint, selectBoxTransform)
          )
        )
      })
      viewModel.getModel().pushEditOperations(result)
      // viewModel.updateElementData(result)
    }
  }
  export const ResizeElement = new ResizeElementCommand()
}
