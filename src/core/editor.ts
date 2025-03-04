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
import { ConfigurationService } from 'Latte/core/services/configuration/configurationService'
import {
  LifecycleService,
  LifecyclePhase,
  Disposable,
} from 'Latte/core/services/lifecycle/lifecycleService'

window.latte = ProxyLatte
class Editor extends Disposable {
  private _modelData: ModelData | null
  private _viewModel: ViewModel
  private _view: View
  private _renderService: RenderService
  private _renderElementObserver: DomElementObserver
  private _cameraService: CameraService<string>
  private _commandService: CommandService
  private _keybindingService: KeybindingService
  private _configurationService: ConfigurationService
  private _lifecycleService: LifecycleService

  constructor(private _domElement: HTMLCanvasElement) {
    super()
    this._lifecycleService = new LifecycleService()
    this.init()
    this._lifecycleService.phase = LifecyclePhase.Ready
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  _getViewModel(): ViewModel {
    return this._viewModel
  }

  getCameraService(): CameraService {
    return this._cameraService
  }

  public init() {
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
    this._configurationService = new ConfigurationService()
  }

  public override dispose() {
    this._view.dispose()
    this._renderElementObserver.dispose()
    this._cameraService.dispose()
    this._commandService.dispose()
    this._keybindingService.dispose()
    this._configurationService.dispose()
    this._lifecycleService.phase = LifecyclePhase.Destroy
    this._lifecycleService.dispose()
    super.dispose()
  }
}

export default Editor
