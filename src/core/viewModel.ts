import type ModelData from 'Latte/core/modelData'
import { ChangeEventType } from 'Latte/core/modelChange'
import { Emitter } from 'Latte/common/event'
import type CameraService from 'Latte/core/cameraService'
import { ViewModelEventDispatcher } from 'Latte/common/viewModelEventDispatcher'
import * as viewEvents from 'Latte/view/viewEvents'
import type { ViewEventHandler } from 'Latte/view/viewEventHandler'
import { ElementTree } from 'Latte/viewModel/elementTree'
import type { Page } from 'Latte/core/page'
import { PickService } from 'Latte/event/pickService'
import type { MouseControllerTarget } from 'Latte/core/activeSelection'
import { ActiveSelection } from 'Latte/core/activeSelection'
import type { DisplayObject } from 'Latte/core/displayObject'
import type { OperateMode } from 'Latte/core/cursor'
import { Cursor } from 'Latte/core/cursor'

export class ViewModel {
  private _focusPageId: string = ''
  private _modelData: ModelData
  pickService: PickService

  private readonly _eventDispatcher: ViewModelEventDispatcher

  private readonly _onFocusPageChange = new Emitter<string>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  private _activeSelection: ActiveSelection

  private _elementTree: ElementTree

  private _cursor: Cursor = new Cursor()

  constructor(model: ModelData, private _cameraService: CameraService) {
    this.getVisibleElementRenderObjects =
      this.getVisibleElementRenderObjects.bind(this)
    this._modelData = model
    this._eventDispatcher = new ViewModelEventDispatcher()
    this._activeSelection = new ActiveSelection()

    this._bindCameraEvent()
    this._initElementTree()
    this._bindModelEvent()

    latte.editor.setOperateMode = this.setCursorOperateMode.bind(this)
  }

  private _initElementTree() {
    this._elementTree = new ElementTree(
      this._modelData.getCurrentState().elements
    )
    this._elementTree.document.getChildren().forEach(page => {
      this._createCamera(page.id, page.getBoundingClientRect())
    })
    this.focusPageId = this._elementTree.document.getChildren()[0].id
    this.pickService = new PickService(
      this.getVisibleElementRenderObjects,
      this._activeSelection,
      this.elementTreeRoot
    )
  }

  private _bindCameraEvent() {
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
  }

  private _bindModelEvent() {
    this._modelData.onElementChange(e => {
      const changeElements: DisplayObject[] = []
      e.forEach(item => {
        if (item.type === ChangeEventType.CREATE) {
          const newObject = this._elementTree.createElementByData(item.target!)
          const focusPage = this._elementTree.getElementById(
            this._focusPageId
          ) as Page
          if (!newObject) {
            return
          }
          focusPage?.appendChild(newObject)
          const camera = this.getCamera()
          focusPage?.setVisibleArea(camera.getViewport())
          this.addSelectElement(newObject)
          return
        }
        const currentNode = this._elementTree.getElementById(
          JSON.stringify(item.target?.guid)
        )
        if (currentNode) {
          currentNode.setElementData(item.target)
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

  private _createCamera(id: string, size: Rectangle) {
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

  public getCamera() {
    return this._cameraService.getCamera(this.focusPageId)
  }

  public addSelectElement = (element: DisplayObject) => {
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

  getCursorHoverObject() {
    return this._cursor.getHoverObject()
  }

  setCursorHoverObject(object: DisplayObject | null) {
    if (object && this._activeSelection.hasSelected(object)) {
      return
    }
    this._cursor.setHoverObject(object, this._eventDispatcher)
  }

  getCursorHoverControllerKey() {
    return this._cursor.getControllerKey()
  }

  setCursorHoverControllerKey(key: MouseControllerTarget) {
    this._cursor.setControllerTarget(key, this._eventDispatcher)
  }

  getCursorOperateMode() {
    return this._cursor.getOperateMode()
  }

  setCursorOperateMode(mode: OperateMode) {
    this._cursor.setOperateMode(mode, this._eventDispatcher)
  }

  getCursorCreateElementType() {
    return this._cursor.getCreateNormalElementType()
  }

  setBoxSelectBounds(points?: IPoint[]) {
    this._cursor.setBoxSelectBounds(this._eventDispatcher, points)
  }

  getBoxSelectBounds() {
    return this._cursor.getBoxSelectBounds()
  }

  getModel() {
    return this._modelData
  }
}
