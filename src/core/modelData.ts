import { createDefaultFile } from 'Latte/common/schema'
import { Emitter } from 'Latte/common/event'
import type { ISingleEditOperation } from 'Latte/core/modelChange'
import { ChangeEventType, ModelChange } from 'Latte/core/modelChange'
import { UndoRedoService } from 'Latte/core/undoRedoService'

interface ISchemaModel {
  pushEditOperations(operations: ISingleEditOperation[]): void
}

export interface IElementChange {
  target: any
  type: ChangeEventType
}

class ModelData implements ISchemaModel {
  private _model: LatteFile = createDefaultFile()
  private _undoRedoService = new UndoRedoService(this)

  private readonly _onSchemaContentChange = new Emitter<IElementChange[]>()
  public readonly onSchemaContentChange = this._onSchemaContentChange.event

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

  applyEdits(operations: ISingleEditOperation[], computeUndoEdits: boolean) {
    return this._doApplyEdits(operations, computeUndoEdits)
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

  private _acceptEditsToModel(
    operations: ISingleEditOperation[],
    computeUndoEdits: boolean
  ) {
    const result: ModelChange[] = []
    const newElements: BaseElementSchema[] = []
    const workOperations = [...operations]
    this._model?.elements.forEach(item => {
      const operationIndex = workOperations.findIndex(
        op => op.id === JSON.stringify(item.guid)
      )
      if (operationIndex > -1) {
        const operation = workOperations.splice(operationIndex, 1)[0]
        const { element, change } = this._computeSingleEditOperation(
          operation,
          item
        )
        if (element) {
          newElements.push(element)
        }
        result.push(change)
      } else {
        newElements.push(item)
      }
    })
    if (workOperations.length) {
      for (let i = 0; i < operations.length; i++) {
        const { element, change } = this._computeSingleEditOperation(
          operations[i]
        )
        newElements.push(element!)
        result.push(change)
      }
    }
    this._model.elements = newElements
    return result
  }

  private _doApplyEdits(
    operations: ISingleEditOperation[],
    computeUndoEdits: boolean
  ) {
    const result = this._acceptEditsToModel(operations, computeUndoEdits)
    const e = result.map(change => ({
      type: change.type,
      target: change.target,
    }))
    this._onSchemaContentChange.fire(e)
    return result
  }

  private _useUndoType(type: ChangeEventType) {
    if (type === ChangeEventType.CREATE) {
      return ChangeEventType.DELETE
    }
    if (type === ChangeEventType.DELETE) {
      return ChangeEventType.CREATE
    }
    return type
  }

  public applyUndo(changes: ModelChange[]) {
    const edits = changes.map(change => ({
      id: change.target,
      type: this._useUndoType(change.type),
      value: change.oldValue,
    }))
    this.applyEdits(edits, false)
  }

  public applyRedo(changes: ModelChange[]) {
    const edits = changes.map(change => ({
      id: change.target,
      type: change.type,
      value: change.newValue,
    }))
    this.applyEdits(edits, false)
  }

  public pushStackElement() {
    this._undoRedoService.pushStackElement()
  }

  public undo() {
    this._undoRedoService.undo()
  }

  public redo() {
    this._undoRedoService.redo()
  }

  public getElementSchemaById(id: string) {
    return this._model.elements.find(item => JSON.stringify(item.guid) === id)
  }
}

export default ModelData
