import ModelData from 'Cditor/core/modelData'
import ViewModel from 'Cditor/core/viewModel'
import RenderContext from 'Cditor/core/renderContext'
import Page from 'Cditor/core/page'

enum RenderEnum {
  ViewportChange,
  ZoomChange,
  ElementChange,
}

function getRealRenderArea(viewport, zoom): RectBBox {
  return {
    x: 0,
    y: 0,
    width: 800,
    height: 800,
  }
}

export default class View {
  private _renderContext: RenderContext
  private _shouldRender: boolean = true
  private _focusPageInstance: Page

  constructor(private _viewModel: ViewModel) {
    this._initElement()
    this._viewModel.onFocusPageChange(this.onFocusPageChange)

    this.getPages().forEach((page, index) => {
      if (index === 0) {
        this._focusPageInstance = page
      }
      const currentViewport = this._viewModel.getViewport(page)
      const currentZoom = this._viewModel.getZoom(page)
      currentViewport.onViewportChange(this._onViewportChange)
      currentZoom.onZoomChange(this._onZoomChange)
    })
  }

  private _initElement() {
    const file = this._viewModel.getCurrentState()
    this._renderContext = new RenderContext(file.elements)
  }

  private onFocusPageChange(e: DefaultIDType) {
    const pages = this._renderContext.getPages()
    const current = pages.find((item) => item.id === JSON.stringify(e))
    if (current) {
      this._focusPageInstance = current
    }
  }

  public getPages(): Page[] {
    return this._renderContext.getPages()
  }

  public shouldRender() {
    return this._shouldRender
  }

  private _onViewportChange(box: RectBBox) {
    const curRenderArea = getRealRenderArea()
    this._focusPageInstance.setVisibleArea(curRenderArea)
    this._shouldRender = true
  }

  private _onElementChange() {
    this._shouldRender = true
  }

  private _onZoomChange(zoom: number) {
    const curRenderArea = getRealRenderArea()
    this._focusPageInstance.setVisibleArea(curRenderArea)
    this._shouldRender = true
  }

  get visibleElementRenderObjects() {
    return this._focusPageInstance.getVisibleElementRenderObjects()
  }
}
