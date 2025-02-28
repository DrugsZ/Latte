import ModelData from 'Latte/core/model/modelData'
import { ViewModel } from 'Latte/core/viweModel/viewModel'
import model from 'Latte/assets/testSchema6.json'
import View from 'Latte/core/view'
import RenderService from 'Latte/render/renderService'
import CameraService from 'Latte/core/services/camera/cameraService'
import DomElementObserver from 'Latte/core/dom/domElementObserver'
import { CommandService } from 'Latte/core/services/command/commandService'
import { KeybindingService } from 'Latte/core/services/keybinding/keybindingService'
import { ProxyLatte } from 'Latte/api'
import { ActiveSelectionWidget } from 'Latte/core/selection/activeSelectionWidget'

window.latte = ProxyLatte
class Editor {
  private _modelData: ModelData | null
  private _viewModel: ViewModel
  private _view: View
  private _renderService: RenderService
  private _renderElementObserver: DomElementObserver
  private _cameraService: CameraService<string>
  private _commandService: CommandService
  private _keybindingService: KeybindingService

  constructor(private _domElement: HTMLCanvasElement) {
    this._renderElementObserver = new DomElementObserver(this._domElement)
    this._cameraService = new CameraService(
      this._renderElementObserver.canvasSize
    )
    this._modelData = new ModelData(model)
    this._viewModel = new ViewModel(this._modelData, this._cameraService)
    this._renderService = new RenderService(this._domElement)
    this._view = new View(
      this._viewModel,
      this._renderService,
      this._domElement
    )
    this._view.render()

    this._commandService = new CommandService()
    this._keybindingService = new KeybindingService(this._commandService)
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _getViewModel(): ViewModel {
    return this._viewModel
  }

  getCameraService(): CameraService {
    return this._cameraService
  }
}

export default Editor
