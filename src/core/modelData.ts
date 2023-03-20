import {
  createDefaultElement,
  createDefaultDocument,
} from 'Cditor/common/schema'

interface IUpdatePayload {
  data: BaseNodeSchema
}

interface ISchemaModel {
  updateModel(payload: IUpdatePayload): void
  addChild(payload: IUpdatePayload): void
  removeChild(target: DefaultIDType): void
}

class ModelData implements ISchemaModel {
  private _model: CditorFile = createDefaultDocument()

  constructor(model?: CditorFile) {
    this._initModel(model)
  }
  updateModel(payload: { data: PAGE }): void {
    this._model.elements = this._model.elements.map((item) =>
      JSON.stringify(item.guid) === JSON.stringify(payload.data.guid)
        ? payload.data
        : item
    )
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
  }
  removeChild(target: DefaultIDType) {
    const newChildren = this._model?.elements.filter(
      (item) => JSON.stringify(item.guid) === JSON.stringify(target)
    )
    this._model = {
      ...this._model,
      elements: newChildren || [],
    }
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
