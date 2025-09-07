import type ModelData from 'Latte/core/model/modelData'
import type { IElementChange } from 'Latte/core/model/modelData'
import { Emitter } from 'Latte/utils/event'
import type CameraService from 'Latte/core/services/camera/cameraService'
import { ViewModelEventDispatcher } from 'Latte/utils/viewModelEventDispatcher'
import * as viewEvents from 'Latte/core/viewParts/base/viewEvents'
import type { ViewEventHandler } from 'Latte/core/viewParts/base/viewEventHandler'
import { ElementTree } from 'Latte/core/elementTree'
import type { Page } from 'Latte/core/elements/page'
import { PickService } from 'Latte/core/services/pick/pickService'
import {
  MouseControllerTarget,
  ActiveSelection,
  ActiveSelectionCorner,
} from 'Latte/core/selection/activeSelection'
import type { DisplayObject } from 'Latte/core/elements/displayObject'
import { OperateMode, Cursor } from 'Latte/core/cursor/cursor'
import type { PickProxy } from 'Latte/core/dom/mouseEvent'
import { registerAPI } from 'Latte/api'

import { ActiveSelectionWidget } from 'Latte/core/selection/activeSelectionWidget'
import type { ISingleEditOperation } from 'Latte/core/model/modelChange'
import { Vector } from 'Latte/utils/vector'

import type { ElementAdsorptionRecord } from 'Latte/core/cursor/cursorAbsorptionLine'

const tempVec2 = Vector.create(0, 0)

export class ViewModel {
  private _focusPageId = ''
  private _modelData: ModelData
  pickService: PickService

  private readonly _eventDispatcher: ViewModelEventDispatcher

  private readonly _onFocusPageChange = new Emitter<string>()
  public readonly onFocusPageChange = this._onFocusPageChange.event

  private _activeSelection: ActiveSelection

  private _elementTree: ElementTree

  private _cursor: Cursor = new Cursor()

  private _pickActive = true

  private _cachePickProxy: PickProxy

  private _activeSelectionWidget: ActiveSelectionWidget

  constructor(model: ModelData, private _cameraService: CameraService) {
    this.getVisibleElementRenderObjects =
      this.getVisibleElementRenderObjects.bind(this)
    this._modelData = model
    this._eventDispatcher = new ViewModelEventDispatcher()
    this._activeSelection = new ActiveSelection()

    this._bindCameraEvent()
    this._initElementTree()
    this._bindModelEvent()
    this._bindCursorEvent()

    this._cursor.onDidCursorOperateModeChange(e => {
      if (e === OperateMode.ReadOnly) {
        this._pickActive = false
      } else {
        this._pickActive = true
      }
    })

    this._activeSelectionWidget = new ActiveSelectionWidget(
      this,
      this._activeSelection
    )

    registerAPI('getSelectionProxy', () => this._activeSelectionWidget)
    registerAPI('setOperateMode', this.setCursorOperateMode.bind(this))
  }

  private _initElementTree() {
    this._elementTree = new ElementTree(
      this._modelData.getCurrentState().elements
    )
    for (const page of this._elementTree.document.getChildren()) {
      this._createCamera(page.id, page.getBoundingClientRect())
    }
    this.focusPageId = this._elementTree.document.getChildren()[0].id
    this.pickService = new PickService(
      this.getVisibleElementRenderObjects,
      this._activeSelection,
      this.elementTreeRoot
    )
  }

  private _createPickProxyCache() {
    const pick = (vec: ReadonlyVec2) => {
      if (!this._pickActive) {
        return this.elementTreeRoot
      }
      return this.pickService.pick.call(this.pickService, vec)
    }

    const pickActiveSelection = (vec: ReadonlyVec2) => {
      if (!this._pickActive) {
        return MouseControllerTarget.NONE
      }
      return this.pickService.pickActiveSelection.call(this.pickService, vec)
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
    const elementSchema = this._modelData.getElementSchemaById(event.target)
    if (!elementSchema) {
      console.warn('Element schema not found for target:', event.target)
      return
    }

    const newNode = this._elementTree.createElementByData(elementSchema)
    const focusPage = this._elementTree.getElementById(
      this._focusPageId
    ) as Page

    if (!newNode || !focusPage) {
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

  private _bindCursorEvent() {
    this._cursor.onCursorStateChange(e => {
      this._eventDispatcher.emitViewEvent(
        new viewEvents.ViewCursorStateChangeEvent(e)
      )
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

  get focusPage() {
    return this.elementTreeRoot.getElementById(this._focusPageId) as Page
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

  setBoxSelectBounds(points?: ReadonlyVec2[]) {
    this._cursor.setBoxSelectBounds(this._eventDispatcher, points)
  }

  getBoxSelectBounds() {
    return this._cursor.getBoxSelectBounds()
  }

  getModel() {
    return this._modelData
  }

  public updateNodeWithAABB(operations: ISingleEditOperation[]) {
    this._modelData.pushEditOperations(operations)
  }

  public onElementWillMove = (movement: ReadonlyVec2) => {
    const objects = this.focusPage.getVisibleElementRenderObjects()
    const vecs: ElementAdsorptionRecord[] = []
    for (const object of objects) {
      if (this._activeSelection.hasSelected(object)) {
        continue
      }
      const center = object.getBounds().getCenter()
      const obbPoints = object.getOBBPoints()
      vecs.push([...obbPoints, center])
    }
    const cur = [
      this._activeSelection.getBounds().getCenter(),
      ...this._activeSelection.getOBBPoints(),
    ]
    return this._cursor.onElementWillMove(vecs, cur, movement)
  }

  public onElementDidMove = () => {
    const cur = [
      this._activeSelection.getBounds().getCenter(),
      ...this._activeSelection.getOBBPoints(),
    ]
    return this._cursor.onElementDidMove(cur)
  }

  public onElementMoveEnd = () => {
    const cur = [
      this._activeSelection.getBounds().getCenter(),
      ...this._activeSelection.getOBBPoints(),
    ]
    this._cursor.onElementMoveEnd(cur)
  }
}
