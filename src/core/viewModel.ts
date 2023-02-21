import View from 'Cditor/core/view'
import ModelData from 'Cditor/core/modelData'

class ViewModel {
    private _focusPath: string[] = []
    private _view: View
    private _modelData: ModelData | null

    constructor(model: ModelData) {
        this._modelData = model
        this._focusPath = [this._modelData.getCurrentState().children[0].id]
        this._view = new View(model)
    }

    get focusPath(): string[] {
        return this._focusPath
    }

    set focusPath(value: string[]) {
        this._focusPath = value
        const [curPage] = value
        this.focusPage = curPage
    }

    get focusPage(): string {
        return this._focusPath[0]
    }

    set focusPage(value: string) {
        this._focusPath = [value]
    }
}

export default ViewModel
