import { createDefaultElement, createDefaultFile } from 'Latte/common/schema'
import { Emitter } from 'Latte/common/event'

interface IUpdatePayload {
  data: Partial<BaseElementSchema>[]
}

interface ISchemaModel {
  updateChild(payload: IUpdatePayload): void
  addChild(payload: IUpdatePayload): void
  removeChild(target: string): void
}

interface ChangeEvent {
  type: 'DELETE' | 'CREATE' | 'CHANGE'
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
          type: 'CHANGE',
          value: this._model.elements[index],
        })
      }
      return !list.length
    })
    this._onElementChange.fire(changeList)
  }
  addChild() {
    this._model?.elements.push(
      createDefaultElement({
        guid: {
          sessionID: 1,
          localID: 1,
        },
        position: 1,
      })
    )
    this._onDataChange.fire(this._model)
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
