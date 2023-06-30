import ViewModel from 'Latte/core/viewModel'
import RenderContext from 'Latte/core/renderContext'
import Page from 'Latte/core/page'
import RenderService from 'Latte/render/renderService'
import MouseHandler from 'Latte/core/mouseHandler'
import { Camera } from 'Latte/core/CameraService'
import { EventBind } from 'Latte/event/EventBind'
import { EventService } from 'Latte/event/EventService'
import { PickService } from 'Latte/event/PickService'

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
  private _eventBind: EventBind
  private _eventService: EventService
  private _pickService: PickService = new PickService()

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
    this._eventService = new EventService(this._renderContext.getRoot())
    this._eventBind = new EventBind(
      this._renderDOM,
      this._eventService,
      this._pickService,
      this.client2Viewport
    )
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

  public client2Viewport(client: IPoint) {
    const currentCamera = this._viewModel.getCamera(this._focusPageInstance.id)
    const scale = currentCamera.getZoom()
    const d = currentCamera.getViewport()
    return {
      x: client.x * scale + d.x,
      y: client.y * scale + d.y,
    }
  }
}
