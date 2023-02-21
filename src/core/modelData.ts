import { createPageModel, createDefaultDocument } from 'Cditor/common/schema'

interface IUpdatePayload {
    data: CditorElement | PAGE
}

interface ISchemaModel {
    updateModel(payload: IUpdatePayload): void
    addChild(payload: IUpdatePayload): void
    removeChild(target: string): void
}

class ModelData implements ISchemaModel {
    private _model: CditorDocument = createDefaultDocument()

    constructor(model?: CditorDocument) {
        this._initModel(model)
    }
    updateModel(payload: { data: PAGE }): void {
        this._model.children = this._model.children.map((item) =>
            item.id === payload.data.id ? payload.data : item
        )
    }
    addChild() {
        this._model?.children.push(createPageModel())
    }
    removeChild(target: string) {
        const newChildren = this._model?.children.filter(
            (item) => item.id === target
        )
        this._model = {
            ...this._model,
            children: newChildren || [],
        }
    }

    getCurrentState() {
        return this._model
    }
    private _initModel(model?: CditorDocument) {
        if (model) {
            this._model = model
        }
    }
}

export default ModelData
