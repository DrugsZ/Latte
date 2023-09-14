import type { ViewModel } from 'Latte/core/viewModel'
import { DisplayObject } from 'Latte/core/displayObject'
import { Page } from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import { CommandsRegistry } from 'Latte/core/commandsRegistry'

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
}
