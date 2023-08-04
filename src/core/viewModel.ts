import type ModelData from 'Latte/core/modelData'
import { Emitter } from 'Latte/common/event'
import CameraService from 'Latte/core/cameraService'
import DomElementObserver from 'Latte/core/domElementObserver'
import { ViewModelEventDispatcher } from 'Latte/common/viewModelEventDispatcher'
import * as viewEvents from 'Latte/view/viewEvents'
import type { ViewEventHandler } from 'Latte/view/viewEventHandler'
import { ElementTree } from 'Latte/viewModel/elementTree'
import type Page from 'Latte/core/page'
import { PickService } from 'Latte/event/pickService'

export class ViewModel {
  private _focusPageId: string = ''
  private _modelData: ModelData
  private _cameraService: CameraService<string>
  private _canvasObserver: DomElementObserver
  pickService: PickService

  private readonly _eventDispatcher: ViewModelEventDispatcher

  private readonly _onFocusPageChange = new Emitter<string>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  private _elementTree: ElementTree

  constructor(model: ModelData, _domElement: HTMLCanvasElement) {
    this.getVisibleElementRenderObjects =
      this.getVisibleElementRenderObjects.bind(this)
    this._modelData = model
    this._canvasObserver = new DomElementObserver(_domElement)
    this._cameraService = new CameraService(this._canvasObserver.canvasSize)
    this._eventDispatcher = new ViewModelEventDispatcher()

    this._cameraService.onCameraViewChange(event => {
      this._eventDispatcher.emitViewEvent(
        new viewEvents.ViewCameraUpdateEvent(event)
      )
      const focusPage = this._elementTree.getElementById(
        this._focusPageId
      ) as Page
      if (focusPage) {
        focusPage.setVisibleArea(event.getViewport())
      }
    })

    this._initElementTree()
  }

  private _initElementTree() {
    this._elementTree = new ElementTree(
      this._modelData.getCurrentState().elements
    )
    this._elementTree.document.getChildren().forEach(page => {
      this.createCamera(page.id, page.getBoundingClientRect())
    })
    this.focusPageId = this._elementTree.document.getChildren()[0].id
    this.pickService = new PickService(this.getVisibleElementRenderObjects)
  }

  get focusPageId() {
    return this._focusPageId
  }

  set focusPageId(value: string) {
    this._focusPageId = value
    this._onFocusPageChange.fire(value)
    this._eventDispatcher.emitViewEvent(
      new viewEvents.ViewFocusPageChangeEvent(JSON.stringify(value))
    )
  }

  get elementTreeRoot() {
    return this._elementTree.document
  }

  public getViewport(id: string) {
    return this._cameraService.getViewport(id)
  }

  getCamera(id: string) {
    return this._cameraService.getCamera(id)
  }

  public createCamera(id: string, size: Rectangle) {
    return this._cameraService.createCamera(id, {
      size,
      padding: 0.1,
    })
  }

  public getCurrentState() {
    return this._modelData.getCurrentState()
  }

  public addViewEventHandler(eventHandler: ViewEventHandler): void {
    this._eventDispatcher.addViewEventHandler(eventHandler)
  }

  public removeViewEventHandler(eventHandler: ViewEventHandler): void {
    this._eventDispatcher.removeViewEventHandler(eventHandler)
  }

  public getVisibleElementRenderObjects() {
    const focusPage = this._elementTree.getElementById(
      this._focusPageId
    ) as Page
    if (!focusPage) {
      return []
    }
    return focusPage.getVisibleElementRenderObjects()
  }

  public getCurrentCamera() {
    return this._cameraService.getCamera(this.focusPageId)
  }
}
