import { createDefaultFile } from 'Latte/common/schema'
import { Emitter } from 'Latte/common/event'
import type { ISingleEditOperation } from 'Latte/core/model/modelChange'
import { ChangeEventType, ModelChange } from 'Latte/core/model/modelChange'
import { UndoRedoService } from 'Latte/core/services/undoRedo/undoRedoService'

interface ISchemaModel {
  pushEditOperations(operations: ISingleEditOperation[]): void
}

export interface IElementChange {
  target: any
}

class ModelData implements ISchemaModel {
  private _model: LatteFile = createDefaultFile()
  private _undoRedoService = new UndoRedoService(this)

  private readonly _onSchemaContentChange = new Emitter<IElementChange[]>()
  public readonly onSchemaContentChange = this._onSchemaContentChange.event

  constructor(model?: LatteFile) {
    this._initModel(model)
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

  private _acceptSingleEditToModel(
    operation: ISingleEditOperation,
    index: number
  ) {
    const { value } = operation
    const item = this._model?.elements[index]
    let newElement: BaseElementSchema | null = item
    if (!value) {
      newElement = null
    } else if (!item) {
      newElement = value as BaseElementSchema
    } else {
      newElement = { ...item, ...value } as BaseElementSchema
    }
    if (~index) {
      if (newElement) {
        this._model.elements[index] = newElement
      } else {
        this._model.elements.splice(index, 1)
      }
    } else if (newElement) {
      this._model.elements.push(newElement)
    }
    return newElement
  }

  private _computeSingleEditOperation(
    operation: ISingleEditOperation,
    oldElement: BaseElementSchema | null,
    newElement: BaseElementSchema | null
  ) {
    const { value, type } = operation
    if (!newElement) {
      return new ModelChange(type, oldElement!.guid, oldElement, newElement)
    }
    if (!oldElement) {
      return new ModelChange(type, newElement.guid!, null, newElement)
    }
    const keys = Reflect.ownKeys(value as Partial<BaseElementSchema>)
    const oldObject = {}
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      oldObject[key] = oldElement[key]
    }

    return new ModelChange(type, oldElement.guid, oldObject, value)
  }

  private _acceptEditsToModel(
    operations: ISingleEditOperation[],
    computeUndoEdits: boolean
  ) {
    const result: ModelChange[] = []
    const newApplyElements: (BaseElementSchema | null)[] = []

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]
      const index = this._model?.elements.findIndex(
        item => op.id === JSON.stringify(item.guid)
      )
      const cacheElement = this._model?.elements[index]
      newApplyElements[i] = this._acceptSingleEditToModel(op, index)
      if (computeUndoEdits) {
        result[i] = this._computeSingleEditOperation(
          op,
          cacheElement,
          newApplyElements[i]
        )
      }
    }

    return result
  }

  private _doApplyEdits(
    operations: ISingleEditOperation[],
    computeUndoEdits: boolean
  ) {
    const result = this._acceptEditsToModel(operations, computeUndoEdits)
    const e = operations.map(op => ({
      target: op.id,
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
