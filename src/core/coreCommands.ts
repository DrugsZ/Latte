import type { ViewModel } from 'Latte/core/viewModel'
import { DisplayObject } from 'Latte/core/displayObject'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { CommandsRegistry } from 'Latte/core/commandsRegistry'
import { Matrix } from 'Latte/math/matrix'
import { Point } from 'Latte/common/Point'
import type { MouseControllerTarget } from 'Latte/core/activeSelection'
import { isResizeXAxisKey, isResizeYAxisKey } from 'Latte/core/activeSelection'

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
    viewModelPartial: ViewModel,
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

  export const CreateNewElement = new (class extends CoreEditorCommand {})()

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
          Matrix.multiply(diffMatrix, transform, diffMatrix)
          diffMatrix.tx = newP1.x
          diffMatrix.ty = newP1.y
          console.log(diffMatrix)
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

    private _getInvertPoint() {}

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

    public runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<ResizeElementCommandOptions>
    ): void {
      const { position, prePosition, key } = args
      if (!position || !prePosition || !key) {
        return
      }
      const activeElement = viewModel.getActiveSelection()

      const {
        x: selectBoxTLX,
        y: selectBoxTLY,
        transform: selectBoxTransform,
        width: selectBoxWidth,
        height: selectBoxHeight,
      } = activeElement.OBB

      const invertTransform = this._getInvertSelectBoxTransform(
        selectBoxTransform
      ) as Matrix

      // getSymbol
      const invertTranPos = this._getPointOnSelectBoxAxis(
        activeElement.OBB,
        position
      )

      const invertTranPrePos = this._getPointOnSelectBoxAxis(
        activeElement.OBB,
        prePosition
      )

      const centerPos = new Point(selectBoxWidth / 2, selectBoxHeight / 2)

      const symbol = new Point(
        invertTranPos.x > centerPos.x ? 1 : -1,
        invertTranPos.y > centerPos.y ? 1 : -1
      )

      const distance = dotProduct(
        subtract(invertTranPrePos, invertTranPos),
        symbol
      )
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
      const newSelectBoxRect = new Point(
        selectBoxWidth - distance.x,
        selectBoxHeight - distance.y
      )
      const scale = new Point(
        1 - distance.x / selectBoxWidth,
        1 - distance.y / selectBoxHeight
      )
      const newSelectBoxTL = new Point(
        symbol.x === 1 ? selectBoxTLX : selectBoxTLX - moveDistance.x,
        symbol.y === 1 ? selectBoxTLY : selectBoxTLY - moveDistance.y
      )

      const objects = activeElement.getObjects()
      const result: Partial<BaseElementSchema>[] = []

      objects.forEach(object => {
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

        const vXOScale = new Point(
          (x - selectBoxTLX) / selectBoxWidth,
          (y - selectBoxTLY) / selectBoxHeight
        )
        const vXO = add(newSelectBoxTL, dotProduct(newSelectBoxRect, vXOScale))

        const vW = new Point(width, 0)
        const vWT = dotProduct(Matrix.apply(vW, localTransform), scale)

        const vWRad = Math.atan2(vWT.y, vWT.x)
        const vWTM = {
          a: Math.cos(vWRad),
          b: Math.sin(vWRad),
          c: -Math.sin(vWRad),
          d: Math.cos(vWRad),
          tx: 0,
          ty: 0,
        }

        const vH = new Point(0, height)
        const vHT = dotProduct(Matrix.apply(vH, localTransform), scale)

        const newInvert = Matrix.invert(vWTM)
        const vHTS1 = Matrix.apply(vHT, newInvert!)
        const vHSkew = Math.PI / 2 - Math.atan2(vHTS1.y, vHTS1.x)
        const vHTM = {
          a: 1,
          b: 0,
          c: Math.tan(vHSkew),
          d: 1,
          tx: 0,
          ty: 0,
        }
        Matrix.multiply(ResizeElementCommand.tempMatrix, vWTM, vHTM)
        Matrix.multiply(
          ResizeElementCommand.tempMatrix,
          ResizeElementCommand.tempMatrix,
          selectBoxTransform
        )
        result.push({
          guid: object.getGuidKey(),
          size: {
            x: Math.sqrt(vWT.x * vWT.x + vWT.y * vWT.y), // object.OBB.width,
            y: vHTS1.y, // Math.sqrt(vHTS.x * vHTS.x + vHTS.y * vHTS.y), // object.OBB.height,
          },
          transform: {
            ...ResizeElementCommand.tempMatrix,
            tx: vXO.x,
            ty: vXO.y,
          },
        })
      })
      viewModel.updateElementData(result)
    }
  }
  export const ResizeElement = new ResizeElementCommand()
}
