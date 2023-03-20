import View from 'Cditor/core/view'
import ModelData from 'Cditor/core/modelData'
import { Emitter } from 'Cditor/common/event'
import ViewportAndZoomService from 'Cditor/core/viewportAndZoomService'

class ViewModel {
  private _focusPath: DefaultIDType[] = []
  private _view: View
  private _modelData: ModelData | null
  private _viewportAndZoomService: ViewportAndZoomService

  private readonly _onFocusPageChange = new Emitter<DefaultIDType>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  constructor(model: ModelData) {
    this._modelData = model
    this._focusPath = [this._modelData.getCurrentState().elements[0].guid]
    this._view = new View(model, this)
    this._viewportAndZoomService = new ViewportAndZoomService()
    this._view.getPages().forEach((page) => {
      const currentViewport = this._viewportAndZoomService.getViewport(page)
      const currentZoom = this._viewportAndZoomService.getZoom(page)
      currentViewport.onViewportChange(page.onViewportChange)
      currentZoom.onZoomChange(page.onZoomChange)
    })
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
}

export default ViewModel
