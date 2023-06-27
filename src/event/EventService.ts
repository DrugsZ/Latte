/* eslint-disable no-param-reassign */
import { FederatedEvent } from 'Latte/core/FederatedEvent'
import { FederatedMouseEvent } from 'Latte/core/FederatedMouseEvent'
import { FederatedPointerEvent } from 'Latte/core/FederatedPointerEvent'
import { FederatedWheelEvent } from 'Latte/core/FederatedWheelEvent'
import type { IEventTarget } from 'Latte/core/interfaces'
import type { DisplayObject } from 'Latte/core/DisplayObject'

const PROPAGATION_LIMIT = 2048
export class EventService {
  private _mappingTable: Record<
    string,
    {
      fn: (e: FederatedEvent) => Promise<void>
      priority: number
    }[]
  > = {}

  private _eventPool: Map<typeof FederatedEvent, FederatedEvent[]> = new Map()

  constructor(private _rootTarget: IEventTarget) {
    this._init()
  }

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

  mapEvent(e: FederatedEvent) {
    // if (!this.rootTarget) {
    //   return
    // }

    const mappers = this._mappingTable[e.type]

    if (mappers) {
      for (let i = 0, j = mappers.length; i < j; i++) {
        mappers[i].fn(e)
      }
    } else {
      console.warn(`[EventService]: Event mapping not defined for ${e.type}`)
    }
  }

  private _init() {
    this._addEventMapping('pointerdown', this._onPointerDown)
    this._addEventMapping('mousedown', this._onPointerDown)
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

  private allocateEvent<T extends FederatedEvent>(constructor: {
    new (boundary: EventService): T
  }): T {
    if (!this._eventPool.has(constructor as any)) {
      this._eventPool.set(constructor as any, [])
    }

    // @ts-ignore
    const event =
      (this._eventPool.get(constructor as any).pop() as T) ||
      new constructor(this)

    event.eventPhase = event.NONE
    event.currentTarget = null
    event.path = []
    event.target = null

    return event
  }

  private freeEvent<T extends FederatedEvent>(event: T) {
    if (event.manager !== this)
      throw new Error(
        'It is illegal to free an event not managed by this EventBoundary!'
      )

    const { constructor } = event

    if (!this._eventPool.has(constructor as any)) {
      this._eventPool.set(constructor as any, [])
    }

    // @ts-ignore
    this._eventPool.get(constructor as any).push(event)
  }

  private async _createPointerEvent(
    from: FederatedPointerEvent,
    type?: string,
    target?: IEventTarget
  ): Promise<FederatedPointerEvent> {
    const event = this.allocateEvent(FederatedPointerEvent)

    EventService.copyPointerData(from, event)
    EventService.copyMouseData(from, event)
    EventService.copyData(from, event)

    event.nativeEvent = from.nativeEvent
    event.originalEvent = from

    event.target = target || this._rootTarget
    if (typeof type === 'string') {
      event.type = type
    }

    return event
  }

  private async _createWheelEvent(
    from: FederatedWheelEvent
  ): Promise<FederatedWheelEvent> {
    const event = this.allocateEvent(FederatedWheelEvent)

    EventService.copyWheelData(from, event)
    EventService.copyMouseData(from, event)
    EventService.copyData(from, event)

    event.nativeEvent = from.nativeEvent
    event.originalEvent = from
    event.target = this._rootTarget
    return event
  }

  public propagationPath(target: DisplayObject): DisplayObject[] {
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
    console.log(from)
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createPointerEvent(from)
    this.freeEvent(e)
  }
  private _onPointerUp = async (from: FederatedEvent) => {
    console.log(from)
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createPointerEvent(from)
    this.freeEvent(e)
  }
  private _onPointerMove = async (from: FederatedEvent) => {
    console.log(from)
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createPointerEvent(from)
    this.freeEvent(e)
  }
  private _onPointerOut = async (from: FederatedEvent) => {
    console.log(from)
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createPointerEvent(from)
    this.freeEvent(e)
  }
  private _onPointerOver = async (from: FederatedEvent) => {
    console.log(from)
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createPointerEvent(from)
    this.freeEvent(e)
  }
  private _onPointerUpOutside = async (from: FederatedEvent) => {
    console.log(from)
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createPointerEvent(from)
    this.freeEvent(e)
  }
  private _onWheel = async (from: FederatedEvent) => {
    console.log(from)
    if (!(from instanceof FederatedWheelEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createWheelEvent(from)
    this.freeEvent(e)
  }
}
