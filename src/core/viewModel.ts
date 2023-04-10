import ModelData from 'Cditor/core/modelData'
import { Emitter } from 'Cditor/common/event'
import ViewportAndZoomService from 'Cditor/core/viewportAndZoomService'
import DomElementObserver from 'Cditor/core/domElementObserver'
import Page from 'Cditor/core/page'

class ViewModel {
  private _focusPath: DefaultIDType[] = []
  private _modelData: ModelData
  private _viewportAndZoomService: ViewportAndZoomService
  private _canvasObserver: DomElementObserver

  private readonly _onFocusPageChange = new Emitter<DefaultIDType>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  constructor(model: ModelData, _domElement: HTMLCanvasElement) {
    this._modelData = model
    this._focusPath = [this._modelData.getCurrentState().elements[0].guid]
    this._canvasObserver = new DomElementObserver(_domElement)
    this._viewportAndZoomService = new ViewportAndZoomService(
      this._canvasObserver
    )
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
    return this._viewportAndZoomService.getViewport(page)
  }

  getZoom(page: Page) {
    return this._viewportAndZoomService.getZoom(page)
  }

  getCurrentState() {
    return this._modelData.getCurrentState()
  }
}

export default ViewModel
