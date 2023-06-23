import ViewModel from 'Cditor/core/viewModel'
import RenderContext from 'Cditor/core/renderContext'
import Page from 'Cditor/core/page'
import RenderService from 'Cditor/render/renderService'
import MouseHandler from 'Cditor/core/mouseHandler'
import { Camera } from 'Cditor/core/CameraService'

export enum RenderEnum {
  ViewportChange,
  ZoomChange,
  ElementChange,
}

export default class View {
  private _renderContext: RenderContext
  private _shouldRender: boolean = true
  private _focusPageInstance: Page
  private _mouseHandler: MouseHandler

  constructor(
    private _viewModel: ViewModel,
    private readonly _renderService: RenderService,
    private readonly _renderDOM: HTMLCanvasElement
  ) {
    this._initElement()
    this._viewModel.onFocusPageChange(this.onFocusPageChange)

    this.getPages().forEach((page, index) => {
      if (index === 0) {
        this._focusPageInstance = page
      }
      const currentCamera = this._viewModel.createCamera(
        page.id,
        page.getBoundingClientRect()
      )
      currentCamera.onCameraViewChange(e => this._onCameraViewChange(e))
    })
    this._mouseHandler = new MouseHandler(this._renderDOM, this)
  }

  private _initElement() {
    const file = this._viewModel.getCurrentState()
    this._renderContext = new RenderContext(file.elements)
  }

  private onFocusPageChange(e: DefaultIDType) {
    const pages = this._renderContext.getPages()
    const current = pages.find(item => item.id === JSON.stringify(e))
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

  private _onCameraViewChange(camera: Camera) {
    this._focusPageInstance.setVisibleArea(camera.getViewport())
    this._shouldRender = true
  }

  private _onElementChange() {
    this._shouldRender = true
  }

  get visibleElementRenderObjects() {
    return this._focusPageInstance.getVisibleElementRenderObjects()
  }

  public render() {
    this._scheduleRender()
  }

  public getCurrentCamera() {
    return this._viewModel.getCamera(this._focusPageInstance.id)
  }

  private _scheduleRender() {
    requestAnimationFrame(() => {
      if (this.shouldRender()) {
        this._renderService.draw(
          this.visibleElementRenderObjects,
          this._viewModel.getCamera(this._focusPageInstance.id).getViewport(),
          this._viewModel.getCamera(this._focusPageInstance.id).getZoom()
        )
        this._shouldRender = false
      }
      this._scheduleRender()
    })
  }
}
