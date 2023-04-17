import ViewModel from 'Cditor/core/viewModel'
import RenderContext from 'Cditor/core/renderContext'
import Page from 'Cditor/core/page'
import RenderService from 'Cditor/core/renderService'

export enum RenderEnum {
  ViewportChange,
  ZoomChange,
  ElementChange,
}

export default class View {
  private _renderContext: RenderContext
  private _shouldRender: boolean = true
  private _focusPageInstance: Page
  private _cacheRenderBox: Rectangle = {
    x: 0,
    y: 0,
    width: 1500,
    height: 1000,
  }

  private _lastMovePosition: {
    x: number
    y: number
  }
  private _isMouseDown: boolean = false

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
      const currentCamera = this._viewModel.getCamera(page)
      currentCamera.onCameraViewChange(e => this._onCameraViewChange(e))
    })
    this._bindViewMouseEvents()
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

  private _onCameraViewChange(box: Rectangle) {
    this._focusPageInstance.setVisibleArea(box)
    this._cacheRenderBox = box
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

  private _scheduleRender() {
    requestAnimationFrame(() => {
      if (this.shouldRender()) {
        this._renderService.draw(
          this.visibleElementRenderObjects,
          this._cacheRenderBox
        )
        this._shouldRender = false
      }
      this._scheduleRender()
    })
  }

  private _bindViewMouseEvents() {
    this._renderDOM.addEventListener('mousedown', e => {
      this._lastMovePosition = {
        x: e.clientX,
        y: e.clientY,
      }
      this._isMouseDown = true
    })
    this._renderDOM.addEventListener('mousemove', e => {
      if (!this._isMouseDown) {
        return
      }
      const newX = e.clientX
      const newY = e.clientY
      const currentCamera = this._viewModel.getCamera(this._focusPageInstance)
      currentCamera.move(
        newX - this._lastMovePosition.x,
        newY - this._lastMovePosition.y
      )
      this._lastMovePosition = {
        x: newX,
        y: newY,
      }
    })
    this._renderDOM.addEventListener('mouseup', () => {
      this._isMouseDown = false
    })
  }
}
