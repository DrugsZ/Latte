import type { ViewModel } from 'Latte/core/viewModel'
import { DisplayObject } from 'Latte/core/displayObject'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { CommandsRegistry } from 'Latte/core/commandsRegistry'
import { Matrix } from 'Latte/math/matrix'

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

  interface SetTransformCommandOptions extends BaseCommandOptions {
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

  export const SetElementTransform =
    new (class extends CoreEditorCommand<SetTransformCommandOptions> {
      constructor() {
        super('moveElement')
      }

      public runCoreEditorCommand(
        viewModel: ViewModel,
        args: Partial<SetTransformCommandOptions>
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
}
