import ModelData from 'Cditor/core/modelData'
import ViewModel from 'Cditor/core/viewModel'
import Page from 'Cditor/core/page'

const initCanvas = () =>{
    const canvas = document.createElement('canvas')
    canvas.setAttribute('width', '800')
    canvas.setAttribute('height', '800')
    canvas.style.width = '800px'
    canvas.style.height = '800px'
    return canvas
  }

export default class View {
    private _modelData: ModelData
    private _viewModel: ViewModel
    private _pages: Page[]
    private _canvas: HTMLCanvasElement = initCanvas()
    private _offScreenCanvas: OffscreenCanvas = this._canvas.transferControlToOffscreen()

    constructor(modelData: ModelData, viewModel:ViewModel) {
        this._modelData = modelData
        this._viewModel = viewModel
        this._initPages()
        document.body.appendChild(this._canvas)
        this._renderFocusPage()
    }

    private _initPages() {
        this._pages = this._modelData.getCurrentState().children.map(pageData => (new Page(pageData, this._offScreenCanvas)))
    }

    private _renderFocusPage() {
        const { focusPageId } = this._viewModel
        const focusPage = this._pages.find(page => page.id === focusPageId)
        focusPage?.renderPage()
    }
}
