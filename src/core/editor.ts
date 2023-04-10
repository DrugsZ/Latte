import ModelData from 'Cditor/core/modelData'
import ViewModel from 'Cditor/core/viewModel'
import model from 'Cditor/assets/testSchema.json'
import View from 'Cditor/core/view'
import DrawService from 'Cditor/core/drawService'

class Editor {
  private _modelData: ModelData | null
  private _viewModel: ViewModel
  private _view: View
  private _domElement: HTMLCanvasElement
  private _drawService: DrawService

  constructor(domElement: HTMLCanvasElement) {
    this._domElement = domElement
    this._modelData = new ModelData(model)
    this._viewModel = new ViewModel(this._modelData, this._domElement)
    this._view = new View(this._viewModel)
    this._drawService = new DrawService(this._domElement)
    this.run()
  }

  public run() {
    requestAnimationFrame(() => {
      if (this._view.shouldRender()) {
        this._drawService.draw(this._view.visibleElementRenderObjects)
      }
      this.run()
    })
  }
}

export default Editor
