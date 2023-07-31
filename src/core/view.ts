import type ViewModel from 'Latte/core/viewModel'
import RenderContext from 'Latte/core/renderContext'
import type Page from 'Latte/core/page'
import type RenderService from 'Latte/render/renderService'
import MouseHandler from 'Latte/core/mouseHandler'
import type { Camera } from 'Latte/core/cameraService'
import { EventBind } from 'Latte/event/eventBind'
import { EventService } from 'Latte/event/eventService'
import { PickService } from 'Latte/event/pickService'
import { SelectBox } from 'Latte/view/selectBox'
import { DisplayObject } from 'Latte/core/displayObject'
import type { ViewPart } from 'Latte/view/viewPart'

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
  private _pickService: PickService
  private _selectBox: SelectBox = new SelectBox()
  private _viewParts: ViewPart[] = []

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
        this._renderContext.onFocusPageChange(page.id)
      }
      const currentCamera = this._viewModel.createCamera(
        page.id,
        page.getBoundingClientRect()
      )
      currentCamera.onCameraViewChange(e => this._onCameraViewChange(e))
    })
    this._pickService = new PickService(this.visibleElementRenderObjects)
    this._mouseHandler = new MouseHandler(this._renderDOM, this)
    this._eventService = new EventService(this._renderContext.getRoot())
    this.client2Viewport = this.client2Viewport.bind(this)
    this._eventBind = new EventBind(
      this._renderDOM,
      this._eventService,
      this._pickService,
      this.client2Viewport
    )
    this._renderContext.getRoot().addEventListener('pointerdown', e => {
      const { target } = e
      if (target instanceof DisplayObject) {
        this._selectBox.addOrRemoveElement(target)
      }
    })
    this._viewParts.push(this._selectBox)
  }

  private _initElement() {
    const file = this._viewModel.getCurrentState()
    this._renderContext = new RenderContext(file.elements)
    this._viewParts.push(this._renderContext)
  }

  private onFocusPageChange(e: DefaultIDType) {
    const pages = this._renderContext.getPages()
    const current = pages.find(item => item.id === JSON.stringify(e))
    if (current) {
      this._focusPageInstance = current
    }
    this._renderContext.onFocusPageChange(JSON.stringify(e))
  }

  public getPages(): Page[] {
    return this._renderContext.getPages()
  }

  public getFocusPageInstance() {
    return this._focusPageInstance
  }

  public shouldRender() {
    return this._shouldRender
  }

  private _onCameraViewChange(camera: Camera) {
    this._focusPageInstance.setVisibleArea(camera.getViewport())
    this._renderContext.forceShouldRender()
    this._selectBox.forceShouldRender()
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

  private _getViewPartsToRender(): ViewPart[] {
    const result: ViewPart[] = []
    let resultLen = 0
    this._viewParts.forEach(viewPart => {
      if (viewPart.shouldRender()) {
        result[resultLen++] = viewPart
      }
    })
    return result
  }

  private _scheduleRender() {
    requestAnimationFrame(() => {
      // if (this.shouldRender()) {
      //   const camera = this._viewModel.getCamera(this._focusPageInstance.id)
      //   this._renderService.draw(this.visibleElementRenderObjects, camera)
      //   this._shouldRender = false
      // }
      this._actualRender()
      this._scheduleRender()
    })
  }

  private _actualRender() {
    // const viewPartsToRender = this._getViewPartsToRender()
    const viewPartsToRender = this._viewParts
    // if (viewPartsToRender.length === 0) {
    //   // Nothing to render
    //   return
    // }
    const camera = this._viewModel.getCamera(this._focusPageInstance.id)
    this._renderService.prepareRender(camera)
    const ctx = this._renderService.getCanvasRenderingContext()
    viewPartsToRender.forEach(viewPart => {
      viewPart.render(ctx, camera)
      viewPart.onDidRender()
    })
  }

  public client2Viewport(client: IPoint) {
    const currentCamera = this._viewModel.getCamera(this._focusPageInstance.id)
    const vpMatrix = currentCamera.getViewPortMatrix()
    return vpMatrix.applyInvertToPoint(client)
  }
}
