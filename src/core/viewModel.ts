import ModelData from 'Cditor/core/modelData'
import { Emitter } from 'Cditor/common/event'
import CameraService from 'Cditor/core/CameraService'
import DomElementObserver from 'Cditor/core/domElementObserver'
import Page from 'Cditor/core/page'

class ViewModel {
  private _focusPath: DefaultIDType[] = []
  private _modelData: ModelData
  private _cameraService: CameraService
  private _canvasObserver: DomElementObserver

  private readonly _onFocusPageChange = new Emitter<DefaultIDType>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  constructor(model: ModelData, _domElement: HTMLCanvasElement) {
    this._modelData = model
    this._focusPath = [this._modelData.getCurrentState().elements[0].guid]
    this._canvasObserver = new DomElementObserver(_domElement)
    this._cameraService = new CameraService(this._canvasObserver.canvasSize)
  }

  get focusPath(): DefaultIDType[] {
    return this._focusPath
  }

  set focusPath(value: DefaultIDType[]) {
    this._focusPath = value
    const [curPage] = value
    this.focusPageId = curPage
  }

  get focusPageId(): DefaultIDType {
    return this._focusPath[0]
  }

  set focusPageId(value: DefaultIDType) {
    this._focusPath = [value]
    this._onFocusPageChange.fire(value)
  }

  getViewport(page: Page) {
    return this._cameraService.getViewport(page)
  }

  getZoom(page: Page) {
    return this._cameraService.getZoom(page)
  }

  getCamera(page: Page) {
    return this._cameraService.getCamera(page)
  }

  getCurrentState() {
    return this._modelData.getCurrentState()
  }
}

export default ViewModel
