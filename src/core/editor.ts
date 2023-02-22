import ModelData from 'Cditor/core/modelData'
import ViewModel from 'Cditor/core/viewModel'
import model from 'Cditor/assets/testSchema.json'

class Editor {
    private _modelData: ModelData | null
    private _viewModel: ViewModel

    constructor() {
        this._modelData = new ModelData(model)
        this._viewModel = new ViewModel(this._modelData)
    }
}

export default Editor
