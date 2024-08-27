import type { ViewModel } from 'Latte/core/viewModel'
import ElementRender from 'Latte/render/elementRender'
import type RenderService from 'Latte/render/renderService'
import { MouseHandler } from 'Latte/core/mouseHandler'
import { SelectBox } from 'Latte/view/selectBox'
import { ViewCursor } from 'Latte/view/viewCursor'
import { ViewEventHandler } from 'Latte/view/viewEventHandler'
import type { ViewPart } from 'Latte/view/viewPart'
import { ViewController } from 'Latte/core/viewController'
import { Matrix } from 'Latte/math/matrix'
import { PickArea } from 'Latte/view/pickArea'
import { DragHandler } from 'Latte/core/dragHandler'
import { Vector } from 'Latte/common/vector'
import { Point } from 'Latte/common/point'

export enum RenderEnum {
  ViewportChange,
  ZoomChange,
  ElementChange,
}

const tempVec2 = Vector.create(0, 0)

export default class View extends ViewEventHandler {
  private _renderElement: ElementRender
  private _mouseHandler: MouseHandler
  private _dragHandler: DragHandler
  // private _eventBind: EventBind
  // private _eventService: EventService
  private _selectBox: SelectBox
  private _viewCursor: ViewCursor
  private _viewParts: ViewPart[] = []
  private _viewController: ViewController
  private _pickArea: PickArea

  constructor(
    private _viewModel: ViewModel,
    private readonly _renderService: RenderService,
    private readonly _renderDOM: HTMLCanvasElement
  ) {
    super()
    // this._initElement()
    this.client2Viewport = this.client2Viewport.bind(this)

    this._viewController = new ViewController(this._viewModel)

    this._renderElement = new ElementRender(
      this._viewModel,
      this._viewModel.getVisibleElementRenderObjects
    )
    this._viewParts.push(this._renderElement)

    this._viewCursor = new ViewCursor(this._viewModel, this._renderDOM)
    this._viewParts.push(this._viewCursor)

    this._selectBox = new SelectBox(this._viewModel)
    this._viewParts.push(this._selectBox)

    this._mouseHandler = new MouseHandler(
      this,
      this._viewController,
      this._renderDOM,
      this._viewModel.pickProxy
    )

    this._pickArea = new PickArea(this._viewModel)
    this._viewParts.push(this._pickArea)
    this._dragHandler = new DragHandler(
      this._renderDOM,
      this.client2Viewport,
      this._viewController
    )
  }

  public render() {
    this._scheduleRender()
  }

  public getCamera() {
    return this._viewModel.getCamera()
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
    const camera = this.getCamera()
    this._renderService.prepareRender(camera)
    const ctx = this._renderService.getCanvasRenderingContext()
    this._viewParts.forEach(viewPart => {
      viewPart.render(ctx, camera)
      viewPart.onDidRender()
    })
  }

  public client2Viewport(vec: ReadonlyVec2) {
    const currentCamera = this.getCamera()
    const vpMatrix = currentCamera.getViewPortMatrix()
    return Matrix.applyMatrixInvertToPoint(vpMatrix, vec)
  }

  public viewport2Client(vec: ReadonlyVec2) {
    const currentCamera = this.getCamera()
    const vpMatrix = currentCamera.getViewPortMatrix()
    return Matrix.apply(vec, vpMatrix)
  }
}
