import type ModelData from 'Latte/core/modelData'
import { Emitter } from 'Latte/common/event'
import CameraService from 'Latte/core/cameraService'
import DomElementObserver from 'Latte/core/domElementObserver'
import { ViewModelEventDispatcher } from 'Latte/common/viewModelEventDispatcher'
import * as viewEvents from 'Latte/view/viewEvents'
import type { ViewEventHandler } from 'Latte/view/viewEventHandler'

export class ViewModel {
  private _focusPath: DefaultIDType[] = []
  private _modelData: ModelData
  private _cameraService: CameraService<string>
  private _canvasObserver: DomElementObserver

  private readonly _eventDispatcher: ViewModelEventDispatcher

  private readonly _onFocusPageChange = new Emitter<DefaultIDType>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  constructor(model: ModelData, _domElement: HTMLCanvasElement) {
    this._modelData = model
    const firstPage = this._modelData
      .getCurrentState()
      .elements.find(item => item.type === 'CANVAS')
    this._focusPath = [firstPage?.guid]
    this._canvasObserver = new DomElementObserver(_domElement)
    this._cameraService = new CameraService(this._canvasObserver.canvasSize)
    this._eventDispatcher = new ViewModelEventDispatcher()

    this._cameraService.onCameraViewChange(event => {
      this._eventDispatcher.emitViewEvent(
        new viewEvents.ViewCameraUpdateEvent(event)
      )
    })
  }

  get focusPath(): DefaultIDType[] {
    return this._focusPath
  }

  set focusPath(value: DefaultIDType[]) {
    this._focusPath = value
    const [curPage] = value
    this.focusPageId = curPage
  }

  get focusPageId(): DefaultIDType {
    return this._focusPath[0]
  }

  set focusPageId(value: DefaultIDType) {
    this._focusPath = [value]
    this._onFocusPageChange.fire(value)
    this._eventDispatcher.emitViewEvent(
      new viewEvents.ViewFocusPageChangeEvent(JSON.stringify(value))
    )
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
}
