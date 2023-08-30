import type { ViewModel } from 'Latte/core/viewModel'
import ElementRender from 'Latte/core/elementRender'
import type RenderService from 'Latte/render/renderService'
import { MouseHandler } from 'Latte/core/mouseHandler'
import { EventBind } from 'Latte/event/eventBind'
import { EventService } from 'Latte/event/eventService'
// import type { PickService } from 'Latte/event/pickService'
import { SelectBox } from 'Latte/view/selectBox'
import { ViewEventHandler } from 'Latte/view/viewEventHandler'
import type { ViewPart } from 'Latte/view/viewPart'
import { ViewController } from 'Latte/core/viewController'
import { Matrix } from 'Latte/math/matrix'

export enum RenderEnum {
  ViewportChange,
  ZoomChange,
  ElementChange,
}

export default class View extends ViewEventHandler {
  private _renderElement: ElementRender
  private _mouseHandler: MouseHandler
  private _eventBind: EventBind
  private _eventService: EventService
  private _selectBox: SelectBox
  private _viewParts: ViewPart[] = []
  private _viewController: ViewController

  constructor(
    private _viewModel: ViewModel,
    private readonly _renderService: RenderService,
    private readonly _renderDOM: HTMLCanvasElement
  ) {
    super()
    // this._initElement()
    this.client2Viewport = this.client2Viewport.bind(this)
    this._renderElement = new ElementRender(
      this._viewModel,
      this._viewModel.getVisibleElementRenderObjects
    )
    this._viewController = new ViewController(this._viewModel)
    this._viewParts.push(this._renderElement)

    this._selectBox = new SelectBox(this._viewModel)
    this._viewParts.push(this._selectBox)

    this._mouseHandler = new MouseHandler(
      this,
      this._viewController,
      this._renderDOM,
      this._viewModel.pickService
    )
    this._eventService = new EventService(this._viewModel.elementTreeRoot)
    this._eventBind = new EventBind(
      this._renderDOM,
      this._eventService,
      this._viewModel.pickService,
      this.client2Viewport
    )
  }

  public render() {
    this._scheduleRender()
  }

  public getCurrentCamera() {
    return this._viewModel.getCurrentCamera()
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
    const camera = this._viewModel.getCurrentCamera()
    this._renderService.prepareRender(camera)
    const ctx = this._renderService.getCanvasRenderingContext()
    this._viewParts.forEach(viewPart => {
      viewPart.render(ctx, camera)
      viewPart.onDidRender()
    })
  }

  public client2Viewport(client: IPoint) {
    const currentCamera = this._viewModel.getCurrentCamera()
    const vpMatrix = currentCamera.getViewPortMatrix()
    return Matrix.applyMatrixInvertToPoint(vpMatrix, client)
  }
}
