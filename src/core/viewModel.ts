import type ModelData from 'Latte/core/modelData'
import { Emitter } from 'Latte/common/event'
import CameraService from 'Latte/core/CameraService'
import DomElementObserver from 'Latte/core/domElementObserver'

class ViewModel {
  private _focusPath: DefaultIDType[] = []
  private _modelData: ModelData
  private _cameraService: CameraService<string>
  private _canvasObserver: DomElementObserver

  private readonly _onFocusPageChange = new Emitter<DefaultIDType>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  constructor(model: ModelData, _domElement: HTMLCanvasElement) {
    this._modelData = model
    const firstPage = this._modelData
      .getCurrentState()
      .elements.find(item => item.type === 'CANVAS')
    this._focusPath = [firstPage?.guid]
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

  getViewport(id: string) {
    return this._cameraService.getViewport(id)
  }

  getCamera(id: string) {
    return this._cameraService.getCamera(id)
  }

  createCamera(id: string, size: Rectangle) {
    return this._cameraService.createCamera(id, {
      size,
      padding: 0.1,
    })
  }

  getCurrentState() {
    return this._modelData.getCurrentState()
  }
}

export default ViewModel
