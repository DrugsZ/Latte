import type { ViewModel } from 'Latte/core/viewModel'
import { DisplayObject } from 'Latte/core/displayObject'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { CommandsRegistry } from 'Latte/core/commandsRegistry'
import { Matrix } from 'Latte/math/matrix'
import { Point } from 'Latte/common/Point'
import type { MouseControllerTarget } from 'Latte/core/activeSelection'
import {
  isResizeXAxisKey,
  isResizeYAxisKey,
  isResetYAxis,
  isResetXAxis,
} from 'Latte/core/activeSelection'
import { createDefaultElementSchema } from 'Latte/common/schema'
import { EditorElementTypeKind } from 'Latte/constants/schema'

export const isLogicTarget = (node?: any): node is DisplayObject =>
  node instanceof DisplayObject &&
  !(node instanceof Page) &&
  !(node instanceof EditorDocument)

const subtract = (a: IPoint, b: IPoint) => new Point(a.x - b.x, a.y - b.y)
const dotProduct = (a: IPoint, b: IPoint) => new Point(a.x * b.x, a.y * b.y)
const add = (a: IPoint, b: IPoint) => new Point(a.x + b.x, a.y + b.y)
const divide = (a: IPoint, b: IPoint) => new Point(a.x / b.x, a.y / b.y)

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

export namespace CoreNavigationCommands {
  interface BaseCommandOptions {
    source: 'mouse' | 'keyboard'
  }

  interface SetActiveSelection extends BaseCommandOptions {
    target: DisplayObject
    multipleMode?: boolean
  }

  interface BaseMoveCommandOptions extends BaseCommandOptions {
    startPosition: IPoint
    position: IPoint
    movement: IPoint
    objects: DisplayObject[]
  }

  interface RotateElementCommandOptions extends BaseCommandOptions {
    objects: DisplayObject[]
    transformOrigin?: IPoint
    rad: number
  }

  interface CreateElementCommandOptions extends BaseCommandOptions {
    type: EditorElementTypeKind
    startPosition: IPoint
    position: IPoint
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

  export const CreateNewElement =
    new (class extends CoreEditorCommand<CreateElementCommandOptions> {
      constructor() {
        super('createElement')
      }
      public runCoreEditorCommand(
        viewModel: ViewModel,
        args: Partial<CreateElementCommandOptions>
      ): void {
        const { position, type, startPosition } = args
        if (!position || !type || !startPosition) {
          return
        }
        const { x: left, y: top } = startPosition
        const { x, y } = startPosition
        const width = x - left
        const height = y - top
        let newShapeSchema
        if (type === EditorElementTypeKind.RECTANGLE) {
          newShapeSchema = createDefaultElementSchema({
            left,
            top,
            width,
            height,
          })
        }
        viewModel.addChild(newShapeSchema)
      }
    })()

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
        const results: Partial<BaseElementSchema>[] = []

        objects.forEach(object => {
          const { x, y, transform } = object
          results.push({
            guid: object.getGuidKey(),
            transform: { ...transform, tx: x + movementX, ty: y + movementY },
          })
        })

        viewModel.updateElementData(results)
      }
    })()

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
        const results: Partial<BaseElementSchema>[] = []

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
          // const skewToY = {
          //   a:transform.d,
          //   b:-transform.c,
          //   c:transform.c,
          //   d:transform.d,
          //   tx:transform.tx,
          //   ty:transform.ty
          // }
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
          results.push({
            guid: object.getGuidKey(),
            transform: { ...diffMatrix },
          })
        })

        viewModel.updateElementData(results)
      }
    })()

  interface ResizeElementCommandOptions extends BaseCommandOptions {
    key: MouseControllerTarget
    position: IPoint
    prePosition: IPoint
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

    private _getChangeSymbol(position: IPoint, selectOBB: OBB) {
      const { width: selectBoxWidth, height: selectBoxHeight } = selectOBB
      const centerPos = new Point(selectBoxWidth / 2, selectBoxHeight / 2)
      const invertTranPos = this._getPointOnSelectBoxAxis(selectOBB, position)
      return new Point(
        invertTranPos.x > centerPos.x ? 1 : -1,
        invertTranPos.y > centerPos.y ? 1 : -1
      )
    }

    private _getRectInfoBeforeAndAfter(
      selectOBB: OBB,
      position: IPoint,
      prePosition: IPoint,
      symbol: IPoint,
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

      const distance = subtract(
        this._getPointOnSelectBoxAxis(selectOBB, position),
        this._getPointOnSelectBoxAxis(selectOBB, prePosition)
      )
      const moveDistance = distance
      if (isResizeXAxisKey(key)) {
        moveDistance.y = 0
      }
      if (isResizeYAxisKey(key)) {
        moveDistance.x = 0
      }
      const distanceWithSymbol = dotProduct(moveDistance, symbol)
      const newSelectBoxRect = new Point(
        selectBoxWidth + distanceWithSymbol.x,
        selectBoxHeight + distanceWithSymbol.y
      )
      const reSetPosPoint = new Point(0, 0)
      if (isResetXAxis(key)) {
        reSetPosPoint.x = moveDistance.x
      }
      if (isResetYAxis(key)) {
        reSetPosPoint.y = moveDistance.y
      }
      const positionChangeOnDefaultAxis = Matrix.apply(reSetPosPoint, {
        ...selectBoxTransform,
        tx: 0,
        ty: 0,
      })
      const newSelectBoxTL = add(
        new Point(selectBoxTLX, selectBoxTLY),
        positionChangeOnDefaultAxis
      )

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
      const { position, prePosition, key } = args
      if (!position || !prePosition || !key) {
        return
      }
      const activeElement = viewModel.getActiveSelection()

      const { transform: selectBoxTransform } = activeElement.OBB

      // get change symbol
      const symbol = this._getChangeSymbol(position, activeElement.OBB)

      const {
        oldSelectBoxTL,
        oldSelectBoxRect,
        newSelectBoxTL,
        newSelectBoxRect,
      } = this._getRectInfoBeforeAndAfter(
        activeElement.OBB,
        position,
        prePosition,
        symbol,
        key
      )

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
      const result: Partial<BaseElementSchema>[] = []

      objects.forEach(object =>
        result.push({
          guid: object.getGuidKey(),
          ...this._getNewOBB(object.OBB, getNewPoint, selectBoxTransform),
        })
      )
      viewModel.updateElementData(result)
    }
  }
  export const ResizeElement = new ResizeElementCommand()
}
