/* eslint-disable no-continue */
import { ModelChange } from 'Latte/core/model/modelChange'
import type { ISingleEditOperation } from 'Latte/core/model/modelChange'
import type ModelData from 'Latte/core/model/modelData'

export interface IResourceUndoRedoElement {
  undo(): Promise<void> | void
  redo(): Promise<void> | void
}

class ModelChangeCompressor {
  private _resultLen: number
  private _currLen: number
  private _prevLen: number
  private _prevEdits: ModelChange[]
  private _currEdits: ModelChange[]
  private _result: ModelChange[]

  private _getCurr(currIndex: number): ModelChange | null {
    return currIndex < this._currLen ? this._currEdits[currIndex] : null
  }

  private _getPrev(prevIndex: number): ModelChange | null {
    return prevIndex < this._prevLen ? this._prevEdits[prevIndex] : null
  }

  private _acceptEdit(edit: ModelChange): void {
    this._result[this._resultLen++] = edit
  }

  private _mergeValue = (preValue: any, newValue: any): void => {
    if (!preValue || !newValue) {
      return preValue
    }

    return { ...preValue, ...newValue }
  }

  private _mergeEdit = (prevEdit: ModelChange, currEdit: ModelChange) => {
    this._result[this._resultLen++] = new ModelChange(
      currEdit.type,
      currEdit.target,
      this._mergeValue(prevEdit.oldValue, currEdit.oldValue),
      this._mergeValue(prevEdit.newValue, currEdit.newValue)
    )
  }

  compress = (
    prevEdits: ModelChange[],
    currEdits: ModelChange[]
  ): ModelChange[] => {
    if (prevEdits === null || prevEdits.length === 0) {
      return currEdits
    }

    this._result = []

    this._prevEdits = prevEdits
    this._prevLen = this._prevEdits.length
    this._currEdits = currEdits
    this._currLen = this._currEdits.length

    let prevIndex = 0
    let currIndex = 0
    this._resultLen = 0

    let prevEdit = this._getPrev(prevIndex)
    let currEdit = this._getCurr(currIndex)

    while (prevIndex < prevEdits.length || currIndex < currEdits.length) {
      if (!prevEdit) {
        this._acceptEdit(currEdit!)
        currEdit = this._getCurr(++currIndex)
        continue
      }

      if (!currEdit) {
        this._acceptEdit(prevEdit!)
        prevEdit = this._getPrev(++prevIndex)
        continue
      }

      if (prevEdit.target === currEdit.target) {
        this._mergeEdit(prevEdit, currEdit)
        currEdit = this._getCurr(++currIndex)
        prevEdit = this._getPrev(++prevIndex)
      } else {
        this._acceptEdit(prevEdit!)
        prevEdit = this._getPrev(++prevIndex)
      }
    }

    return this._result
  }
}
const changeCompressor = new ModelChangeCompressor()
const compressConsecutiveChanges = changeCompressor.compress

class SingleModelEditStackData {
  public changes: ModelChange[] = []

  public append(model: ModelData, changes: ModelChange[]): void {
    if (changes.length > 0) {
      this.changes = compressConsecutiveChanges(this.changes, changes)
    }
  }

  public serialize() {
    return JSON.stringify(this.changes)
  }

  public static deserialize(data: string) {
    const curr = new SingleModelEditStackData()
    curr.changes = JSON.parse(data)
    return curr
  }
}

class ResourceStackElement implements IResourceUndoRedoElement {
  private _data: SingleModelEditStackData | string
  constructor(private readonly _model: ModelData) {
    this._data = new SingleModelEditStackData()
  }

  close() {
    if (this._data instanceof SingleModelEditStackData) {
      this._data = this._data.serialize()
    }
  }

  append(model: ModelData, changes: ModelChange[]) {
    if (this._data instanceof SingleModelEditStackData) {
      this._data.append(model, changes)
    }
  }

  public canAppend() {
    return this._data instanceof SingleModelEditStackData
  }

  undo(): void | Promise<void> {
    if (this._data instanceof SingleModelEditStackData) {
      this._data = this._data.serialize()
    }
    const data = SingleModelEditStackData.deserialize(this._data)
    this._model.applyUndo(data.changes)
  }

  redo(): void | Promise<void> {
    if (this._data instanceof SingleModelEditStackData) {
      this._data = this._data.serialize()
    }
    const data = SingleModelEditStackData.deserialize(this._data)
    this._model.applyRedo(data.changes)
  }
}

class ResourceEditStack {
  private _past: ResourceStackElement[] = []
  private _future: ResourceStackElement[] = []
  public versionId: number = 0

  public pushElement(element: ResourceStackElement): void {
    this._future = []
    this._past.push(element)
    this.versionId++
  }

  public getClosestPastElement(): ResourceStackElement | null {
    if (this._past.length === 0) {
      return null
    }
    return this._past[this._past.length - 1]
  }

  public getClosestFutureElement(): ResourceStackElement | null {
    if (this._future.length === 0) {
      return null
    }
    return this._future[this._future.length - 1]
  }

  public moveBackward(element: ResourceStackElement): void {
    this._past.pop()
    this._future.push(element)
    this.versionId++
  }

  public moveForward(element: ResourceStackElement): void {
    this._future.pop()
    this._past.push(element)
    this.versionId++
  }
}

export class UndoRedoService {
  private readonly _editStacks: Map<any, ResourceEditStack> = new Map()

  constructor(private readonly _model: ModelData) {}

  pushElement(element: ResourceStackElement, id: any): void {
    let editStack: ResourceEditStack
    if (this._editStacks.has(id)) {
      editStack = this._editStacks.get(id)!
    } else {
      editStack = new ResourceEditStack()
      this._editStacks.set(id, editStack)
    }
    editStack.pushElement(element)
  }

  getLastElement(id: any) {
    if (this._editStacks.has(id)) {
      return this._editStacks.get(id)!.getClosestPastElement()
    }
    return null
  }

  getOrCreateEditStackElement(id: any) {
    const editStack = this.getLastElement(id)

    if (editStack && editStack.canAppend()) {
      return editStack
    }

    const newEditStack = new ResourceStackElement(this._model)
    this.pushElement(newEditStack, id)
    return newEditStack
  }

  getOrCreateEditStack(id: any) {
    if (this._editStacks.has(id)) {
      return this._editStacks.get(id)!
    }

    const newEditStack = new ResourceEditStack()
    this._editStacks.set(id, newEditStack)
    return newEditStack
  }

  pushEditOperation(operations: ISingleEditOperation[]) {
    const changes = this._model.applyEdits(operations, true)
    const editStack = this.getOrCreateEditStackElement(this._model)

    editStack.append(
      this._model,
      changes.sort((a, b) =>
        JSON.stringify(a.target).localeCompare(JSON.stringify(b.target))
      )
    )
  }

  redo() {
    if (!this._editStacks.has(this._model)) {
      return
    }
    const editStack = this._editStacks.get(this._model)!
    const element = editStack.getClosestFutureElement()!
    if (!element) {
      return
    }
    editStack.moveForward(element)
    element.redo()
  }

  undo() {
    if (!this._editStacks.has(this._model)) {
      return
    }
    const editStack = this._editStacks.get(this._model)!
    const element = editStack.getClosestPastElement()!
    if (!element) {
      return
    }
    editStack.moveBackward(element)
    element.undo()
  }

  pushStackElement() {
    const lastElement = this.getLastElement(this._model)
    if (lastElement?.canAppend()) {
      lastElement.close()
    }
  }
}
