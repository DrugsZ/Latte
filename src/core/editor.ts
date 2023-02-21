import ModelData from 'Cditor/core/modelData'
import ViewModel from 'Cditor/core/viewModel'

class Editor {
    private _modelData: ModelData | null
    private _viewModel: ViewModel

    constructor() {
        this._modelData = new ModelData()
        this._viewModel = new ViewModel(this._modelData)
    }
}

export default Editor
