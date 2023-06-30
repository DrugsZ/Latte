import ModelData from 'Latte/core/modelData'
import ViewModel from 'Latte/core/viewModel'
import model from 'Latte/assets/testSchema2.json'
import View from 'Latte/core/View'
import RenderService from 'Latte/render/renderService'

class Editor {
  private _modelData: ModelData | null
  private _viewModel: ViewModel
  private _view: View
  private _domElement: HTMLCanvasElement
  private _renderService: RenderService

  constructor(domElement: HTMLCanvasElement) {
    this._domElement = domElement
    this._modelData = new ModelData(model)
    this._viewModel = new ViewModel(this._modelData, this._domElement)
    this._renderService = new RenderService(this._domElement)
    this._view = new View(
      this._viewModel,
      this._renderService,
      this._domElement
    )
    this._view.render()
  }
}

export default Editor
