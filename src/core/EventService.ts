/* eslint-disable no-param-reassign */
import { FederatedEvent } from 'Cditor/core/FederatedEvent'
import { FederatedMouseEvent } from 'Cditor/core/FederatedMouseEvent'
import { FederatedPointerEvent } from 'Cditor/core/FederatedPointerEvent'
import { FederatedWheelEvent } from 'Cditor/core/FederatedWheelEvent'
import type { IEventTarget } from 'Cditor/core/interfaces'
import type BaseElement from 'Cditor/core/baseElement'

const PROPAGATION_LIMIT = 2048
export class EventService {
  private _mappingTable: Record<
    string,
    {
      fn: (e: FederatedEvent) => Promise<void>
      priority: number
    }[]
  > = {}

  private _rootTarget = document

  private _addEventMapping(
    type: string,
    fn: (e: FederatedEvent) => Promise<void>
  ) {
    if (!this._mappingTable[type]) {
      this._mappingTable[type] = []
    }

    this._mappingTable[type].push({
      fn,
      priority: 0,
    })
    this._mappingTable[type].sort((a, b) => a.priority - b.priority)
  }

  private init() {
    this._addEventMapping('pointerdown', this._onPointerDown)
    this._addEventMapping('pointerup', this._onPointerUp)
    this._addEventMapping('pointermove', this._onPointerMove)
    this._addEventMapping('pointerout', this._onPointerOut)
    this._addEventMapping('pointerleave', this._onPointerOut)
    this._addEventMapping('pointerover', this._onPointerOver)
    this._addEventMapping('pointerupoutside', this._onPointerUpOutside)
    this._addEventMapping('wheel', this._onWheel)
  }

  static copyPointerData(from: FederatedEvent, to: FederatedEvent) {
    if (
      !(
        from instanceof FederatedPointerEvent &&
        to instanceof FederatedPointerEvent
      )
    )
      return

    to.pointerId = from.pointerId
    to.width = from.width
    to.height = from.height
    to.isPrimary = from.isPrimary
    to.pointerType = from.pointerType
    to.pressure = from.pressure
    to.tangentialPressure = from.tangentialPressure
    to.tiltX = from.tiltX
    to.tiltY = from.tiltY
    to.twist = from.twist
  }

  static copyMouseData(from: FederatedEvent, to: FederatedEvent) {
    if (
      !(
        from instanceof FederatedMouseEvent && to instanceof FederatedMouseEvent
      )
    )
      return

    to.altKey = from.altKey
    to.button = from.button
    to.buttons = from.buttons
    to.ctrlKey = from.ctrlKey
    to.metaKey = from.metaKey
    to.shiftKey = from.shiftKey
    to.client.copyFrom(from.client)
    to.movement.copyFrom(from.movement)
    to.canvas.copyFrom(from.canvas)
    to.screen.copyFrom(from.screen)
    to.global.copyFrom(from.global)
    to.offset.copyFrom(from.offset)
  }

  static copyWheelData(from: FederatedWheelEvent, to: FederatedWheelEvent) {
    to.deltaMode = from.deltaMode
    to.deltaX = from.deltaX
    to.deltaY = from.deltaY
    to.deltaZ = from.deltaZ
  }

  static copyData(from: FederatedEvent, to: FederatedEvent) {
    to.isTrusted = from.isTrusted
    to.timeStamp = performance.now()
    to.type = from.type
    to.detail = from.detail
    to.view = from.view
    to.page.copyFrom(from.page)
    to.viewport.copyFrom(from.viewport)
  }

  private async createPointerEvent(
    from: FederatedPointerEvent,
    type?: string,
    target?: IEventTarget
  ): Promise<FederatedPointerEvent> {
    const event = new FederatedPointerEvent(this)

    EventService.copyPointerData(from, event)
    EventService.copyMouseData(from, event)
    EventService.copyData(from, event)

    event.nativeEvent = from.nativeEvent
    event.originalEvent = from

    event.target = target!
    if (typeof type === 'string') {
      event.type = type
    }

    return event
  }

  public propagationPath(target: BaseElement): BaseElement[] {
    const propagationPath = [target]

    for (let i = 0; i < PROPAGATION_LIMIT && target !== this._rootTarget; i++) {
      if (!target.parentNode) {
        throw new Error('Cannot find propagation path to disconnected target')
      }

      propagationPath.push(target.parentNode)

      target = target.parentNode
    }

    propagationPath.reverse()

    return propagationPath
  }

  private _onPointerDown = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this.createPointerEvent(from)
  }
  private _onPointerUp = async (from: FederatedEvent) => {}
  private _onPointerMove = async (from: FederatedEvent) => {}
  private _onPointerOut = async (from: FederatedEvent) => {}
  private _onPointerOver = async (from: FederatedEvent) => {}
  private _onPointerDown = async (from: FederatedEvent) => {}
  private _onPointerUpOutside = async (from: FederatedEvent) => {}
  private _onWheel = async (from: FederatedEvent) => {}
}
