import View from 'Cditor/core/view'
import ModelData from 'Cditor/core/modelData'
import { Emitter } from 'Cditor/common/event'
import Viewport from 'Cditor/core/viewport'

class ViewModel {
    private _focusPath: string[] = []
    private _view: View
    private _modelData: ModelData | null
    private _viewport: Viewport

    private readonly _onFocusPageChange = new Emitter<string>()
    public readonly onFocusPageChange = this._onFocusPageChange.event

    constructor(model: ModelData) {
        this._modelData = model
        this._focusPath = [this._modelData.getCurrentState().children[0].id]
        this._view = new View(model, this)
    }

    get focusPath(): string[] {
        return this._focusPath
    }

    set focusPath(value: string[]) {
        this._focusPath = value
        const [curPage] = value
        this.focusPageId = curPage
    }

    get focusPageId(): string {
        return this._focusPath[0]
    }

    set focusPageId(value: string) {
        this._focusPath = [value]
        this._onFocusPageChange.fire(value)
    }
}

export default ViewModel
