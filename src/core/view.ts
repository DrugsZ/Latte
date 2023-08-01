import type { ViewModel } from 'Latte/core/viewModel'
import RenderContext from 'Latte/core/renderContext'
import type RenderService from 'Latte/render/renderService'
import MouseHandler from 'Latte/core/mouseHandler'
import { EventBind } from 'Latte/event/eventBind'
import { EventService } from 'Latte/event/eventService'
import { PickService } from 'Latte/event/pickService'
import { SelectBox } from 'Latte/view/selectBox'
import { ViewEventHandler } from 'Latte/view/viewEventHandler'
import type { ViewPart } from 'Latte/view/viewPart'
import * as viewEvents from 'Latte/view/viewEvents'

export enum RenderEnum {
  ViewportChange,
  ZoomChange,
  ElementChange,
}

export default class View extends ViewEventHandler {
  private _renderContext: RenderContext
  private _mouseHandler: MouseHandler
  private _eventBind: EventBind
  private _eventService: EventService
  private _pickService: PickService
  private _selectBox: SelectBox
  private _viewParts: ViewPart[] = []
  private _focusPageId: string

  constructor(
    private _viewModel: ViewModel,
    private readonly _renderService: RenderService,
    private readonly _renderDOM: HTMLCanvasElement
  ) {
    super()
    this._initElement()
    this._selectBox = new SelectBox(this._viewModel)

    this._renderContext.getPages().forEach((page, index) => {
      if (index === 0) {
        this._renderContext.onFocusPageChange(
          new viewEvents.ViewFocusPageChangeEvent(page.id)
        )
        this._focusPageId = page.id
      }
      this._viewModel.createCamera(page.id, page.getBoundingClientRect())
    })
    this._pickService = new PickService(
      this._renderContext.visibleElementRenderObjects
    )
    this._mouseHandler = new MouseHandler(this._renderDOM, this)
    this._eventService = new EventService(this._renderContext.getRoot())
    this.client2Viewport = this.client2Viewport.bind(this)
    this._eventBind = new EventBind(
      this._renderDOM,
      this._eventService,
      this._pickService,
      this.client2Viewport
    )
    this._renderContext
      .getRoot()
      .addEventListener('pointerdown', this._selectBox.onCanvasMouseDown)
    this._viewParts.push(this._selectBox)
  }

  private _initElement() {
    const file = this._viewModel.getCurrentState()
    this._renderContext = new RenderContext(file.elements, this._viewModel)
    this._viewParts.push(this._renderContext)
  }

  public render() {
    this._scheduleRender()
  }

  public getCurrentCamera() {
    return this._viewModel.getCamera(this._focusPageId)
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
      this._actualRender()
      this._scheduleRender()
    })
  }

  private _actualRender() {
    const viewPartsToRender = this._getViewPartsToRender()
    // const viewPartsToRender = this._viewParts
    if (viewPartsToRender.length === 0) {
      // Nothing to render
      return
    }
    const camera = this._viewModel.getCamera(this._focusPageId)
    this._renderService.prepareRender(camera)
    const ctx = this._renderService.getCanvasRenderingContext()
    this._viewParts.forEach(viewPart => {
      viewPart.render(ctx, camera)
      viewPart.onDidRender()
    })
  }

  public client2Viewport(client: IPoint) {
    const currentCamera = this._viewModel.getCamera(this._focusPageId)
    const vpMatrix = currentCamera.getViewPortMatrix()
    return vpMatrix.applyInvertToPoint(client)
  }

  public override onFocusPageChange(
    event: viewEvents.ViewFocusPageChangeEvent
  ): boolean {
    this._focusPageId = event.newFocusPageId
    return true
  }
}
