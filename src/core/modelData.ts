import { createDefaultElement, createDefaultFile } from 'Latte/common/schema'
import { Emitter } from 'Latte/common/event'

interface IUpdatePayload {
  data: Partial<BaseElementSchema>[]
}

interface IAddChildPayload {
  data: BaseElementSchema[]
}

interface ISchemaModel {
  updateChild(payload: IUpdatePayload): void
  addChild(payload: IAddChildPayload): void
  removeChild(target: string): void
}

export enum ChangeEventType {
  DELETE = 'DELETE',
  CREATE = 'CREATE',
  CHANGE = 'CHANGE',
}

interface ChangeEvent {
  type: ChangeEventType
  value: BaseElementSchema
}

class ModelData implements ISchemaModel {
  private _model: LatteFile = createDefaultFile()

  private readonly _onDataChange = new Emitter<LatteFile>()
  private readonly onDataChange = this._onDataChange.event

  private readonly _onElementChange = new Emitter<ChangeEvent[]>()
  public readonly onElementChange = this._onElementChange.event

  constructor(model?: LatteFile) {
    this._initModel(model)
  }
  updateChild(payload: IUpdatePayload): void {
    const { data } = payload
    const list = [...data]
    const changeList: ChangeEvent[] = []
    this._model.elements.some((item, index) => {
      const currentItemIndex = list.findIndex(i => i.guid === item.guid)
      if (~currentItemIndex) {
        const currentItem = list.splice(currentItemIndex, 1)[0]
        this._model.elements[index] = {
          ...item,
          ...currentItem,
        }
        changeList.push({
          type: ChangeEventType.CHANGE,
          value: this._model.elements[index],
        })
      }
      return !list.length
    })
    this._onElementChange.fire(changeList)
  }
  addChild(payload: IAddChildPayload) {
    this._model?.elements.push(...payload.data)
    this._onElementChange.fire(
      payload.data.map(item => ({ type: ChangeEventType.CREATE, value: item }))
    )
  }
  removeChild(target: string) {
    const newChildren = this._model?.elements.filter(
      item => JSON.stringify(item.guid) === JSON.stringify(target)
    )
    this._model = {
      ...this._model,
      elements: newChildren || [],
    }
    this._onDataChange.fire(this._model)
  }

  getCurrentState() {
    return this._model
  }
  private _initModel(model?: LatteFile) {
    if (model) {
      this._model = model
    }
  }
}

export default ModelData
