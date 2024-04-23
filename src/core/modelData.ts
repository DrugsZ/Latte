import { createDefaultFile } from 'Latte/common/schema'
import { Emitter } from 'Latte/common/event'
import type {
  ISingleEditOperation,
  ChangeEventType,
} from 'Latte/core/modelChange'
import { ModelChange } from 'Latte/core/modelChange'
import { UndoRedoService } from 'Latte/core/undoRedoService'

interface ISchemaModel {
  pushEditOperations(operations: ISingleEditOperation[]): void
}
window.testObj = {
  type: 2,
  id: {
    sessionID: 25,
    localID: 2,
  },
  value: {
    transform: {
      a: 0.7071067690849304,
      b: 0.7071067690849304,
      tx: -495.41872232764075,
      c: -0.7071067690849304,
      d: 0.7071067690849304,
      ty: -1108.7735610373184,
    },
  },
}
interface IElementCHange {
  target: BaseElementSchema | null
  type: ChangeEventType
}

class ModelData implements ISchemaModel {
  private _model: LatteFile = createDefaultFile()
  private _undoRedoService = new UndoRedoService(this)

  private readonly _onElementChange = new Emitter<IElementCHange[]>()
  public readonly onElementChange = this._onElementChange.event

  constructor(model?: LatteFile) {
    this._initModel(model)
    window._undoRedoService = this._undoRedoService
  }

  getCurrentState() {
    return this._model
  }
  private _initModel(model?: LatteFile) {
    if (model) {
      this._model = model
    }
  }

  public pushEditOperations(operations: ISingleEditOperation[]) {
    this._undoRedoService.pushEditOperation(operations)
  }

  applyEdits(operations: ISingleEditOperation[]) {
    return this._doApplyEdits(operations)
  }

  private _computeSingleEditOperation(
    operation: ISingleEditOperation,
    item?: BaseElementSchema
  ) {
    const { value, type } = operation
    if (!value) {
      return {
        element: null,
        change: new ModelChange(type, item!.guid, item, value),
      }
    }
    if (!item) {
      return {
        element: value as BaseElementSchema,
        change: new ModelChange(type, value.guid!, null, value),
      }
    }
    const keys = Reflect.ownKeys(value)
    const oldObject = {}
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      oldObject[key] = item[key]
    }

    return {
      element: { ...item, ...value } as BaseElementSchema,
      change: new ModelChange(type, item.guid, oldObject, value),
    }
  }

  private _acceptEditsToModel(operations: ISingleEditOperation[]) {
    const result: {
      afterElement: BaseElementSchema | null
      change: ModelChange
    }[] = []
    const newElements: BaseElementSchema[] = []
    this._model?.elements.forEach(item => {
      const operationIndex = operations.findIndex(
        op => JSON.stringify(op.id) === JSON.stringify(item.guid)
      )
      if (operationIndex > -1) {
        const operation = operations.splice(operationIndex, 1)[0]
        const { element, change } = this._computeSingleEditOperation(
          operation,
          item
        )
        if (element) {
          newElements.push(element)
        }
        result.push({
          afterElement: element,
          change,
        })
      } else {
        newElements.push(item)
      }
    })
    if (operations.length) {
      for (let i = 0; i < operations.length; i++) {
        const { element, change } = this._computeSingleEditOperation(
          operations[i]
        )
        newElements.push(element!)
        result.push({
          afterElement: element,
          change,
        })
      }
    }
    this._model.elements = newElements
    return result
  }

  private _doApplyEdits(operations: ISingleEditOperation[]) {
    const result = this._acceptEditsToModel(operations)
    const e = result.map(({ afterElement, change }) => ({
      type: change.type,
      target: afterElement,
    }))
    this._onElementChange.fire(e)

    return result.map(item => item.change)
  }

  public applyUndo(changes: ModelChange[]) {
    const edits = changes.map(change => ({
      id: change.target,
      type: change.type,
      value: change.oldValue,
    }))
    this.applyEdits(edits)
  }

  public applyRedo(changes: ModelChange[]) {
    const edits = changes.map(change => ({
      id: change.target,
      type: change.type,
      value: change.newValue,
    }))
    this.applyEdits(edits)
  }

  public pushStackElement() {
    this._undoRedoService.pushStackElement()
  }
}

export default ModelData
