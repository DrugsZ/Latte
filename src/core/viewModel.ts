import type ModelData from 'Latte/core/modelData'
import type { IElementChange } from 'Latte/core/modelData'
import { Emitter } from 'Latte/common/event'
import type CameraService from 'Latte/core/cameraService'
import { ViewModelEventDispatcher } from 'Latte/common/viewModelEventDispatcher'
import * as viewEvents from 'Latte/view/viewEvents'
import type { ViewEventHandler } from 'Latte/view/viewEventHandler'
import { ElementTree } from 'Latte/viewModel/elementTree'
import type { Page } from 'Latte/core/page'
import { PickService } from 'Latte/event/pickService'
import {
  MouseControllerTarget,
  ActiveSelection,
  ActiveSelectionCorner,
} from 'Latte/core/activeSelection'
import type { DisplayObject } from 'Latte/core/displayObject'
import { OperateMode, Cursor } from 'Latte/core/cursor'
import type { PickProxy } from 'Latte/event/mouseEvent'
import { registerAPI } from 'Latte/api'

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

  private _pickActive: boolean = true

  private _cachePickProxy: PickProxy

  constructor(model: ModelData, private _cameraService: CameraService) {
    this.getVisibleElementRenderObjects =
      this.getVisibleElementRenderObjects.bind(this)
    this._modelData = model
    this._eventDispatcher = new ViewModelEventDispatcher()
    this._activeSelection = new ActiveSelection()

    this._bindCameraEvent()
    this._initElementTree()
    this._bindModelEvent()

    this._cursor.onDidCursorOperateModeChange(e => {
      if (e !== OperateMode.Edit) {
        this._pickActive = false
      } else {
        this._pickActive = true
      }
    })

    registerAPI('setOperateMode', this.setCursorOperateMode.bind(this))
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

  private _createPickProxyCache() {
    const pick = (point: IPoint) => {
      if (!this._pickActive) {
        return this.elementTreeRoot
      }
      return this.pickService.pick.call(this.pickService, point)
    }

    const pickActiveSelection = (point: IPoint) => {
      if (!this._pickActive) {
        return MouseControllerTarget.NONE
      }
      return this.pickService.pickActiveSelection.call(this.pickService, point)
    }

    this._cachePickProxy = {
      pick,
      pickActiveSelection,
    }
  }

  get pickProxy() {
    if (!this._cachePickProxy) {
      this._createPickProxyCache()
    }
    return this._cachePickProxy
  }

  private _bindCameraEvent() {
    this._cameraService.onCameraViewChange(event => {
      this._eventDispatcher.emitViewEvent(
        new viewEvents.ViewCameraUpdateEvent(event)
      )
      ActiveSelectionCorner.setScale(event.getZoom())
      const focusPage = this._elementTree.getElementById(
        this._focusPageId
      ) as Page
      if (focusPage) {
        focusPage.setVisibleArea(event.getViewport())
      }
    })
  }

  private _onCreateElementHandler(event: IElementChange) {
    const newNode = this._elementTree.createElementByData(
      this._modelData.getElementSchemaById(event.target)!
    )
    const focusPage = this._elementTree.getElementById(
      this._focusPageId
    ) as Page
    if (!newNode) {
      return
    }
    focusPage?.appendChild(newNode)
    const camera = this.getCamera()
    focusPage?.setVisibleArea(camera.getViewport())
    this.addSelectElement(newNode)
    return newNode
  }

  private _onUpdateElementHandler(event: IElementChange) {
    const currentNode = this._elementTree.getElementById(event.target)
    const newData = this._modelData.getElementSchemaById(event.target)
    if (currentNode && newData) {
      currentNode.setElementData(newData)
    }
    return currentNode
  }

  private _onDeleteElementHandler(event: IElementChange) {
    const currentNode = this._elementTree.getElementById(event.target)
    if (currentNode) {
      currentNode.parentNode?.removeChild(currentNode)
      const focusPage = this._elementTree.getElementById(
        this._focusPageId
      ) as Page
      const camera = this.getCamera()
      focusPage?.setVisibleArea(camera.getViewport())
      if (this._activeSelection.hasSelected(currentNode)) {
        this._activeSelection.removeSelectElement(currentNode)
      }
      return currentNode
    }
  }

  private _onElementHandler(event: IElementChange) {
    let result: undefined | DisplayObject
    const changeElement = this._modelData.getElementSchemaById(event.target)
    const currentNode = this._elementTree.getElementById(event.target)
    if (changeElement && currentNode) {
      result = this._onUpdateElementHandler(event)
    } else if (!changeElement) {
      result = this._onDeleteElementHandler(event)
    } else {
      result = this._onCreateElementHandler(event)
    }
    return result
  }

  private _bindModelEvent() {
    this._modelData.onSchemaContentChange(e => {
      const changeElements: DisplayObject[] = e
        .map(this._onElementHandler, this)
        .filter(item => !!item) as DisplayObject[]
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
