import type ModelData from 'Latte/core/modelData'
import { ChangeEventType } from 'Latte/core/modelData'
import { Emitter } from 'Latte/common/event'
import CameraService from 'Latte/core/cameraService'
import DomElementObserver from 'Latte/core/domElementObserver'
import { ViewModelEventDispatcher } from 'Latte/common/viewModelEventDispatcher'
import * as viewEvents from 'Latte/view/viewEvents'
import type { ViewEventHandler } from 'Latte/view/viewEventHandler'
import { ElementTree } from 'Latte/viewModel/elementTree'
import type { Page } from 'Latte/core/page'
import { PickService } from 'Latte/event/pickService'
import type { ViewMouseModeType } from 'Latte/core/viewMouseMode'
import { ViewMouseMode } from 'Latte/core/viewMouseMode'
import { ActiveSelection } from 'Latte/core/activeSelection'
import type { DisplayObject } from 'Latte/core/displayObject'
import { createDefaultRect } from 'Latte/common/schema'
import type { Container } from 'Latte/core/container'
import { plusOne } from 'Latte/math/zIndex'
import { OperateModeState } from 'Latte/core/operateModeState'

export class ViewModel {
  private _focusPageId: string = ''
  private _modelData: ModelData
  private _cameraService: CameraService<string>
  private _canvasObserver: DomElementObserver
  private _viewMouseMode: ViewMouseMode = new ViewMouseMode()
  pickService: PickService

  private readonly _eventDispatcher: ViewModelEventDispatcher

  private readonly _onFocusPageChange = new Emitter<string>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  private _activeSelection: ActiveSelection

  private _elementTree: ElementTree

  private _operateModeState = new OperateModeState()

  constructor(model: ModelData, _domElement: HTMLCanvasElement) {
    this.getVisibleElementRenderObjects =
      this.getVisibleElementRenderObjects.bind(this)
    this._modelData = model
    this._canvasObserver = new DomElementObserver(_domElement)
    this._cameraService = new CameraService(this._canvasObserver.canvasSize)
    this._eventDispatcher = new ViewModelEventDispatcher()
    this._activeSelection = new ActiveSelection()

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

    this._modelData.onElementChange(e => {
      const changeElements: DisplayObject[] = []
      e.forEach(item => {
        if (item.type === ChangeEventType.CREATE) {
          const newObject = this._elementTree.createElementByData(item.value)
          const focusPage = this._elementTree.getElementById(
            this._focusPageId
          ) as Page
          if (!newObject) {
            return
          }
          focusPage?.appendChild(newObject)
          const camera = this.getCurrentCamera()
          focusPage?.setVisibleArea(camera.getViewport())
          return
        }
        const { value } = item
        const currentNode = this._elementTree.getElementById(
          JSON.stringify(value.guid)
        )
        if (currentNode) {
          currentNode.setElementData(value)
          changeElements.push(currentNode)
        }
      })
      this._eventDispatcher.emitViewEvent(
        new viewEvents.ViewElementChangeEvent(
          changeElements,
          viewEvents.ViewElementChangeType.ViewElementChanged
        )
      )
      this._activeSelection.updateOBB()
    })
  }

  private _initElementTree() {
    this._elementTree = new ElementTree(
      this._modelData.getCurrentState().elements
    )
    this._elementTree.document.getChildren().forEach(page => {
      this.createCamera(page.id, page.getBoundingClientRect())
    })
    this.focusPageId = this._elementTree.document.getChildren()[0].id
    this.pickService = new PickService(
      this.getVisibleElementRenderObjects,
      this._activeSelection,
      this.elementTreeRoot
    )
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

  public setMouseMode(mode: ViewMouseModeType) {
    this._viewMouseMode.setMode(mode)
    this._eventDispatcher.emitViewEvent(
      new viewEvents.ViewMouseModeChangeEvent(mode)
    )
  }

  public getMouseMode() {
    return this._viewMouseMode.getMode()
  }

  public addSelectElement(element: DisplayObject) {
    if (this._activeSelection.hasSelected(element)) {
      return
    }
    this._activeSelection.addSelectElement(element)
    this._eventDispatcher.emitViewEvent(
      new viewEvents.ViewActiveSelectionChangeEvent(
        [element],
        viewEvents.ViewActiveSelectionChangeType.ViewActiveSelectionElementAdded
      )
    )
  }

  public removeSelectElement(element: DisplayObject) {
    if (!this._activeSelection.hasSelected(element)) {
      return
    }
    this._activeSelection.removeSelectElement(element)
    this._eventDispatcher.emitViewEvent(
      new viewEvents.ViewActiveSelectionChangeEvent(
        [element],
        viewEvents.ViewActiveSelectionChangeType.ViewActiveSelectionElementAdded
      )
    )
  }

  public discardActiveSelection() {
    this._activeSelection.clear()
    this._eventDispatcher.emitViewEvent(
      new viewEvents.ViewActiveSelectionChangeEvent(
        this._activeSelection.getObjects(),
        viewEvents.ViewActiveSelectionChangeType.ViewActiveSelectionElementRemoved
      )
    )
  }

  public getActiveSelection() {
    return this._activeSelection
  }

  public updateElementData(objects: Partial<BaseElementSchema>[]) {
    this._modelData.updateChild({
      data: objects,
    })
  }

  public addChild({ left, top }, target?: Container) {
    const currentTarget =
      target || this._elementTree.getElementById(this._focusPageId)
    if (!currentTarget) {
      return
    }
    const parentIndex = JSON.parse(this._focusPageId)
    const newRect = createDefaultRect({ left, top }, parentIndex)
    const lastElement = currentTarget.getLast()
    if (lastElement) {
      newRect.parentIndex.position = plusOne(lastElement.zIndex)
    }

    this._modelData.addChild({
      data: [newRect],
    })
  }

  public getOperateModeState() {
    return this._operateModeState
  }
}
