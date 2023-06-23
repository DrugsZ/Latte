import {
  createDefaultElement,
  createDefaultDocument,
} from 'Latte/common/schema'
import { Emitter } from 'Latte/common/event'

interface IUpdatePayload {
  data: BaseNodeSchema
}

interface ISchemaModel {
  updateModel(payload: IUpdatePayload): void
  addChild(payload: IUpdatePayload): void
  removeChild(target: string): void
}

interface ChangeEvent {
  type: 'DELETE' | 'CREATE' | 'CHANGE'
  value: Element
}

class ModelData implements ISchemaModel {
  private _model: CditorFile = createDefaultDocument()

  private readonly _onDataChange = new Emitter<CditorFile>()
  private readonly onDataChange = this._onDataChange.event

  private readonly _onElementChange = new Emitter<ChangeEvent[]>()
  private readonly onElementChange = this._onElementChange.event

  constructor(model?: CditorFile) {
    this._initModel(model)
  }
  updateModel(payload: { data: PAGE }): void {
    this._model.elements = this._model.elements.map(item =>
      JSON.stringify(item.guid) === JSON.stringify(payload.data.guid)
        ? payload.data
        : item
    )
    this._onDataChange.fire(this._model)
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
  private _initModel(model?: CditorFile) {
    if (model) {
      this._model = model
    }
  }
}

export default ModelData
