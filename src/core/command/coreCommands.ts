import type { ViewModel } from 'Latte/core/viweModel/viewModel'
import { DisplayObject } from 'Latte/core/elements/displayObject'
import { Page } from 'Latte/core/elements/page'
import { EditorDocument } from 'Latte/core/elements/document'
import { CommandsRegistry } from 'Latte/core/services/command/commandsRegistry'
import { MouseControllerTarget } from 'Latte/core/selection/activeSelection'
import {
  createDefaultElementSchema,
  deepCopySchema,
  getUId,
} from 'Latte/utils/schema'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { rTreeRoot } from 'Latte/core/rTree'
import type { ISingleEditOperation } from 'Latte/core/model/modelChange'
import { EditOperation } from 'Latte/core/model/modelChange'
import type { IKeybindings } from 'Latte/core/services/keybinding/keybindingsRegistry'
import { KeybindingsRegistry } from 'Latte/core/services/keybinding/keybindingsRegistry'
import { KeyCode, KeyMod } from 'Latte/utils/keyCodes'
import { calcPosition } from 'Latte/core/utils/zIndex'
import { CursorMoveOperations } from 'Latte/core/cursor/cursorMoveOperations'
import { CursorUpdateOperations } from 'Latte/core/cursor/cursorUpdateOperations'
import { SAT } from 'Latte/core/utils/sat'
import {
  create,
  subtract as vectorSubtract,
  add as vectorAdd,
  divide as vectorDivide,
} from 'Latte/utils/vector'

export const isLogicTarget = (node?: unknown): node is DisplayObject =>
  node instanceof DisplayObject &&
  !(node instanceof Page) &&
  !(node instanceof EditorDocument)

export interface ICommandKeybindingsOptions extends IKeybindings {
  weight: number
  /**
   * the default keybinding arguments
   */
  args?: unknown
}
export interface ICommandOptions {
  id: string
  kbOpts?: ICommandKeybindingsOptions | ICommandKeybindingsOptions[]
}

export abstract class Command {
  public id: string
  private readonly _kbOpts:
    | ICommandKeybindingsOptions
    | ICommandKeybindingsOptions[]
    | undefined
  constructor(opts: ICommandOptions) {
    this.id = opts.id
    this._kbOpts = opts.kbOpts
  }
  public register(): void {
    if (this._kbOpts) {
      const kbOptsArr = Array.isArray(this._kbOpts)
        ? this._kbOpts
        : [this._kbOpts]
      kbOptsArr.forEach(kbOpts => {
        const desc = {
          id: this.id,
          weight: kbOpts.weight,
          args: kbOpts.args,
          primary: kbOpts.primary,
          secondary: kbOpts.secondary,
        }

        KeybindingsRegistry.registerKeybindingRule(desc)
      })
    }
    CommandsRegistry.registerCommand(this.id, args => this.runCommand(args))
  }

  public abstract runCommand(args: unknown): void | Promise<void>
}

function registerCommand<T extends Command>(command: T): T {
  command.register()
  return command
}

// export abstract class Command {
//   constructor(public id: string) {

//   }
//   public register(): void {
//     CommandsRegistry.registerCommand(this.id, args => this.runCommand(args))
//   }

//   public abstract runCommand(args: any): void | Promise<void>
// }

export abstract class CoreEditorCommand<T> extends Command {
  public runCommand(args: unknown) {
    const viewModel = globalThis.getEditor()._getViewModel()
    if (!viewModel) {
      return
    }
    this.runCoreEditorCommand(viewModel, args || {})
  }
  public abstract runCoreEditorCommand(
    viewModel: ViewModel,
    args: Partial<T>
  ): void
}

interface BaseCommandOptions {
  source: 'mouse' | 'keyboard'
}
// CoreNavigationCommands interfaces
interface SetActiveSelection extends BaseCommandOptions {
  target: DisplayObject
  multipleMode?: boolean
}

interface MouseBoxSelectCommandOptions extends BaseCommandOptions {
  startPosition?: ReadonlyVec2
  position?: ReadonlyVec2
}

// CoreNavigationCommands exports
export const SetActiveSelection =
  new (class extends CoreEditorCommand<SetActiveSelection> {
    constructor() {
      super({
        id: 'setActiveSelection',
      })
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

export const MouseBoxSelect =
  new (class extends CoreEditorCommand<MouseBoxSelectCommandOptions> {
    constructor() {
      super({
        id: 'mouseBoxSelect',
      })
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
      const result = SAT.testCollision(selectBoxBounds, displayObjects)
      viewModel.discardActiveSelection()
      if (result.length) {
        result.forEach(viewModel.addSelectElement)
      }
    }
  })()

// CoreEditingCommands interfaces
interface CreateElementCommandOptions<
  T extends BaseElementSchema = RectangleElement
> extends BaseCommandOptions {
  position: ReadonlyVec2
  startPosition: ReadonlyVec2
  paint: Paint | Paint[]
  parent: BaseElementSchema['guid']
  sourceElement: T
  insertAfter: BaseElementSchema['parentIndex']['position']
  insertBefore: BaseElementSchema['parentIndex']['position']
}

interface BaseMoveToCommandOptions extends BaseCommandOptions {
  position: latte.editor.SetStateAction<ReadonlyVec2>
  objects: DisplayObject[]
}

interface BaseMoveCommandOptions extends BaseCommandOptions {
  startPosition: ReadonlyVec2
  position: ReadonlyVec2
  movement: ReadonlyVec2
  objects: DisplayObject[]
}

interface RotateElementCommandOptions extends BaseCommandOptions {
  objects: DisplayObject[]
  transformOrigin?: ReadonlyVec2
  rad: number
}

interface ResizeElementCommandOptions extends BaseCommandOptions {
  key: MouseControllerTarget
  position: ReadonlyVec2
}

interface UpdateElementFillsCommandOptions extends BaseCommandOptions {
  objects: DisplayObject[]
  newFills: Paint[]
}

// CoreEditingCommands exports

export const CreateNewElement =
  new (class extends CoreEditorCommand<CreateElementCommandOptions> {
    constructor() {
      super({
        id: 'createElement',
      })
    }

    private _getCreateResizeKey(
      position: ReadonlyVec2,
      startPosition: ReadonlyVec2
    ) {
      const [x, y] = startPosition
      const [newX, newY] = position
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
      position: ReadonlyVec2,
      startPosition: ReadonlyVec2
    ) {
      ResizeElement.runCoreEditorCommand(viewModel, {
        key: this._getCreateResizeKey(position, startPosition),
        position,
      })
    }

    private _createElement(
      viewModel: ViewModel,
      startPosition: ReadonlyVec2,
      position?: ReadonlyVec2
    ) {
      const type = viewModel.getCursorCreateElementType()
      let [left, top] = startPosition
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

    private _calcPaintElementPosition(paints: Paint[]) {
      let row = 1
      let column = paints.length
      if (paints.length > 2) {
        row = Math.ceil(Math.sqrt(paints.length))
        column = (paints.length / row) >> 0
      }
      const result: {
        position: ReadonlyVec2
        paint: Paint
      }[] = []
      const box = create(0, 0) // new Point(0, 0)
      const pre = create(0, 0) // new Point(0, 0)
      paints.forEach((paint, index) => {
        result.push({
          position: create(pre[0], box[1]),
          paint,
        })
        pre[0] += (paint as ImagePaint).originalImageWidth
        pre[1] = Math.max(pre[1], (paint as ImagePaint).originalImageHeight)
        if (!((index + 1) % column)) {
          box[0] = Math.max(pre[0], box[0])
          box[1] += pre[1]
          pre[1] = 0
          pre[0] = 0
        }
      })
      return {
        paintElementsPosition: result,
        paintElementsBox: box,
      }
    }

    private _createByPaint(
      defaultSchema: BaseElementSchema,
      position: ReadonlyVec2,
      paint: Paint
    ) {
      if (paint) {
        defaultSchema.fillPaints = [paint]
      }
      ;[defaultSchema.transform.tx, defaultSchema.transform.ty] = position
      defaultSchema.size.x = (paint as ImagePaint).originalImageWidth
      defaultSchema.size.y = (paint as ImagePaint).originalImageHeight
      defaultSchema.name = (paint as ImagePaint).image.name
      return defaultSchema
    }

    private _createByPaints(
      defaultSchema: BaseElementSchema,
      position: ReadonlyVec2,
      paints: Paint[]
    ) {
      const { paintElementsPosition, paintElementsBox } =
        this._calcPaintElementPosition(paints)
      const startPoint = vectorSubtract(
        position,
        vectorDivide(paintElementsBox, create(2, 2))
      )
      return paintElementsPosition.map(p => {
        const { position, paint } = p
        const currentSchema = deepCopySchema(defaultSchema)
        currentSchema.guid = getUId()
        return this._createByPaint(
          currentSchema,
          vectorAdd(position, startPoint),
          paint
        )
      })
    }

    private _resetPosition(
      shapes: BaseElementSchema[],
      parent: BaseElementSchema['guid'],
      insertAfter?: BaseElementSchema['parentIndex']['position'],
      insertBefore?: BaseElementSchema['parentIndex']['position']
    ) {
      let curStart = insertAfter
      shapes.forEach(item => {
        item.parentIndex.guid = JSON.parse(JSON.stringify(parent))
        curStart = calcPosition(curStart, insertBefore)
        if (!curStart) {
          curStart = item.parentIndex.position
        }
        item.parentIndex.position = curStart
      })
    }

    private _resetName(
      shapes: BaseElementSchema[],
      viewModel: ViewModel
    ): BaseElementSchema[] {
      const { elementTreeRoot } = viewModel
      const cacheNum = {}
      shapes.forEach(item => {
        const { type } = item
        if (!cacheNum[type]) {
          const last = elementTreeRoot.getElementByTagName(type)
          if (last.length) {
            cacheNum[type] = last[last.length - 1].name.match(/\d+$/)?.[0] || 0
          } else {
            cacheNum[type] = 0
          }
        }
        item.name = `${type} ${++cacheNum[type]}`
      })
      return shapes
    }

    private _runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<CreateElementCommandOptions>
    ) {
      const { position, startPosition, paint, sourceElement } = args
      if (!startPosition) {
        return
      }
      const result: BaseElementSchema[] = []
      if (sourceElement) {
        const defaultSchema = deepCopySchema(sourceElement)
        defaultSchema.guid = getUId()
        result.push(defaultSchema)
      }
      if (paint) {
        const currentPaint = Array.isArray(paint) ? paint : [paint]
        result.push(
          ...this._createByPaints(
            this._createElement(viewModel, startPosition, position),
            startPosition,
            currentPaint
          )
        )
      }
      result.push(this._createElement(viewModel, startPosition, position))
      return result
    }

    public runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<CreateElementCommandOptions>
    ): void {
      const { position, startPosition, insertAfter, insertBefore, parent } =
        args
      if (!startPosition || !parent) {
        return
      }
      const activeSelection = viewModel.getActiveSelection()
      if (activeSelection.isActive() && position) {
        this._resizeActiveCreate(viewModel, position, startPosition)
      } else {
        const result: ISingleEditOperation[] = []
        const newShapes = this._runCoreEditorCommand(viewModel, args)
        if (newShapes) {
          this._resetPosition(newShapes, parent, insertAfter, insertBefore)
          this._resetName(newShapes, viewModel)
          result.push(
            ...newShapes.map(newShape =>
              EditOperation.create(newShape.guid, newShape)
            )
          )
        }
        viewModel.getModel().pushEditOperations(result)
      }
    }
  })()

export const MoveElementTo =
  new (class extends CoreEditorCommand<BaseMoveToCommandOptions> {
    constructor() {
      super({
        id: 'moveElementTo',
      })
    }

    public runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<BaseMoveToCommandOptions>
    ): void {
      const { position, objects } = args
      if (!position || !objects || !objects.length) return
      viewModel.updateNodeWithAABB(CursorMoveOperations.move(position, objects))
      // viewModel.updateElementData(results)
    }
  })()

export const MoveElement =
  new (class extends CoreEditorCommand<BaseMoveCommandOptions> {
    constructor() {
      super({
        id: 'moveElement',
      })
    }

    public runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<BaseMoveCommandOptions>
    ): void {
      let { objects } = args
      const { movement } = args
      if (!objects) {
        objects = viewModel.getActiveSelection().getObjects()
      }
      if (!objects || !movement) return
      viewModel
        .getModel()
        .pushEditOperations(
          CursorMoveOperations.move(pre => vectorAdd(pre, movement), objects)
        )
      // viewModel.updateElementData(results)
    }
  })()

export const RotateElementTransform =
  new (class extends CoreEditorCommand<RotateElementCommandOptions> {
    constructor() {
      super({
        id: 'rotateElement',
      })
    }

    public runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<RotateElementCommandOptions>
    ): void {
      const { objects, rad, transformOrigin } = args
      if (!objects || !objects.length || !rad) {
        return
      }
      viewModel.updateNodeWithAABB(
        CursorMoveOperations.rotate(objects, rad, transformOrigin)
      )
      // viewModel.updateElementData(results)
    }
  })()

class ResizeElementCommand extends CoreEditorCommand<ResizeElementCommandOptions> {
  constructor() {
    super({
      id: 'resizeElement',
    })
  }

  public runCoreEditorCommand(
    viewModel: ViewModel,
    args: Partial<ResizeElementCommandOptions>
  ): void {
    const { position, key } = args
    if (!position || !key) {
      return
    }
    const result = CursorMoveOperations.resize(
      key,
      position,
      viewModel.getActiveSelection()
    )
    if (result) {
      viewModel.updateNodeWithAABB(result)
    }
    // viewModel.updateElementData(result)
  }
}
export const ResizeElement = new ResizeElementCommand()

export const SetElementFills =
  new (class extends CoreEditorCommand<UpdateElementFillsCommandOptions> {
    constructor() {
      super({
        id: 'updateElementFills',
      })
    }

    public runCoreEditorCommand(
      viewModel: ViewModel,
      args: Partial<UpdateElementFillsCommandOptions>
    ): void {
      const { objects, newFills } = args
      if (!objects || !objects.length) {
        return
      }
      viewModel
        .getModel()
        .pushEditOperations(CursorUpdateOperations.setFills(objects, newFills))
      // viewModel.updateElementData(results)
    }
  })()

export const Undo = registerCommand(
  new (class extends CoreEditorCommand<null> {
    constructor() {
      super({
        id: 'undo',
        kbOpts: {
          primary: KeyMod.CtrlCmd | KeyCode.KeyZ,
          weight: 1,
        },
      })
    }

    runCoreEditorCommand(viewModel: ViewModel) {
      viewModel.getModel().undo()
    }
  })()
)

export const Redo = registerCommand(
  new (class extends CoreEditorCommand<null> {
    constructor() {
      super({
        id: 'redo',
        kbOpts: {
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ,
          weight: 1,
        },
      })
    }

    runCoreEditorCommand(viewModel: ViewModel) {
      viewModel.getModel().redo()
    }
  })()
)

export const DeleteElement = registerCommand(
  new (class extends CoreEditorCommand<null> {
    constructor() {
      super({
        id: 'delete',
        kbOpts: {
          primary: KeyCode.Backspace,
          weight: 1,
        },
      })
    }

    runCoreEditorCommand(viewModel: ViewModel) {
      const activeSelection = viewModel.getActiveSelection()
      const objects = activeSelection.getObjects()
      if (objects.length < 1) {
        return
      }
      const result = objects.map(object =>
        EditOperation.delete(object.getGuidKey())
      )
      viewModel.getModel().pushEditOperations(result)
    }
  })()
)
