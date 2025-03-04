import type { ViewModel } from 'Latte/core/viweModel/viewModel'
import ElementRender from 'Latte/render/elementRender'
import type RenderService from 'Latte/render/renderService'
import { MouseHandler } from 'Latte/core/dom/mouseHandler'
import { SelectBox } from 'Latte/core/viewParts/selectBox/selectBox'
import { ViewCursor } from 'Latte/core/viewParts/cursor/viewCursor'
import { ViewEventHandler } from 'Latte/core/viewParts/base/viewEventHandler'
import type { ViewPart } from 'Latte/core/viewParts/base/viewPart'
import { ViewController } from 'Latte/core/view/viewController'
import { Matrix } from 'Latte/core/utils/matrix'
import { PickArea } from 'Latte/core/viewParts/pickArea/pickArea'
import { DragHandler } from 'Latte/core/dom/dragHandler'
import { ViewAdsorptionLine } from 'Latte/core/viewParts/adsorptionLine/viewAdsorptionLine'
import { ViewGrid } from 'Latte/core/viewParts/grid/viewGrid'

export enum RenderEnum {
  ViewportChange,
  ZoomChange,
  ElementChange,
}

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
  private _viewAdsorptionLine: ViewAdsorptionLine
  private _viewGrid: ViewGrid

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

    this._viewAdsorptionLine = new ViewAdsorptionLine(this._viewModel)
    this._viewParts.push(this._viewAdsorptionLine)

    this._viewGrid = new ViewGrid(this._viewModel)
    this._viewParts.push(this._viewGrid)

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

  public override dispose(): void {
    for (const viewPart of this._viewParts) {
      viewPart.dispose()
    }
    super.dispose()
  }
}
