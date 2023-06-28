/* eslint-disable no-param-reassign */
import { FederatedEvent } from 'Latte/core/FederatedEvent'
import { FederatedMouseEvent } from 'Latte/core/FederatedMouseEvent'
import { FederatedPointerEvent } from 'Latte/core/FederatedPointerEvent'
import { FederatedWheelEvent } from 'Latte/core/FederatedWheelEvent'
import type { IEventTarget } from 'Latte/core/interfaces'
import { Point } from 'Latte/math/Point'
import { isDisplayObject } from 'Latte/utils/assert'

type Picker = (event: Point) => IEventTarget | null

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

  private _pickHandler: Picker

  constructor(private _rootTarget: IEventTarget) {
    this._init()
  }

  public setPickHandler(pickHandler: Picker) {
    this._pickHandler = pickHandler
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

  private notifyTarget(e: FederatedEvent, type?: string) {
    type = type ?? e.type
    const key =
      e.eventPhase === e.CAPTURING_PHASE || e.eventPhase === e.AT_TARGET
        ? `${type}capture`
        : type

    this.notifyListeners(e, key)

    if (e.eventPhase === e.AT_TARGET) {
      this.notifyListeners(e, type)
    }
  }

  private notifyListeners(e: FederatedEvent, type: string) {
    // @ts-ignore
    const emitter = e.currentTarget.emitter
    // @ts-ignore
    const listeners = (emitter._events as EmitterListeners)[type]

    if (!listeners) return

    if ('fn' in listeners) {
      if (listeners.once) {
        emitter.removeListener(type, listeners.fn, undefined, true)
      }
      listeners.fn.call(e.currentTarget || listeners.context, e)
    } else {
      for (
        let i = 0;
        i < listeners.length && !e.propagationImmediatelyStopped;
        i++
      ) {
        if (listeners[i].once) {
          emitter.removeListener(type, listeners[i].fn, undefined, true)
        }
        listeners[i].fn.call(e.currentTarget || listeners[i].context, e)
      }
    }
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

    event.target = target || this._pickHandler(event.canvas) || this._rootTarget
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

  dispatchEvent(e: FederatedEvent, type: string, skipPropagate?: boolean) {
    if (!skipPropagate) {
      e.propagationStopped = false
      e.propagationImmediatelyStopped = false
      this.propagate(e, type)
    } else {
      e.eventPhase = e.AT_TARGET
      const canvas = this._rootTarget || null
      e.currentTarget = canvas
      this.notifyListeners(e, type)
    }
  }

  propagate(e: FederatedEvent, type?: string) {
    if (!e.target) {
      return
    }

    // [target, parent, root, Canvas]
    const composedPath = e.composedPath()

    // event flow: capture -> target -> bubbling

    // capture phase
    e.eventPhase = e.CAPTURING_PHASE
    for (let i = composedPath.length - 1; i >= 1; i--) {
      e.currentTarget = composedPath[i]
      this.notifyTarget(e, type)
      if (e.propagationStopped || e.propagationImmediatelyStopped) return
    }

    // target phase
    e.eventPhase = e.AT_TARGET
    e.currentTarget = e.target
    this.notifyTarget(e, type)
    if (e.propagationStopped || e.propagationImmediatelyStopped) return

    // find current target in composed path
    const index = composedPath.indexOf(e.currentTarget)

    // bubbling phase
    e.eventPhase = e.BUBBLING_PHASE
    for (let i = index + 1; i < composedPath.length; i++) {
      e.currentTarget = composedPath[i]
      this.notifyTarget(e, type)
      if (e.propagationStopped || e.propagationImmediatelyStopped) return
    }
  }

  public propagationPath(target: IEventTarget): IEventTarget[] {
    const propagationPath = [target]

    for (let i = 0; i < PROPAGATION_LIMIT && target !== this._rootTarget; i++) {
      if (isDisplayObject(target) && target.parentNode) {
        propagationPath.push(target.parentNode)

        target = target.parentNode
      }
    }

    propagationPath.reverse()

    return propagationPath
  }

  private _onPointerDown = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const e = await this._createPointerEvent(from)
    this.dispatchEvent(e, 'pointerdown')
    if (e.pointerType === 'mouse') {
      const isRightButton = e.button === 2

      this.dispatchEvent(e, isRightButton ? 'rightdown' : 'mousedown')
    }
    this.freeEvent(e)
  }

  private _onPointerMove = async (from: FederatedEvent) => {
    console.log(from)
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const e = await this._createPointerEvent(from)
    this.dispatchEvent(e, 'pointermove')
    if (e.pointerType === 'mouse') {
      const isRightButton = e.button === 2

      this.dispatchEvent(e, isRightButton ? 'rightmove' : 'mousemove')
    }
    this.freeEvent(e)
  }

  private _onPointerUp = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const e = await this._createPointerEvent(from)
    this.dispatchEvent(e, 'pointerup')
    if (e.pointerType === 'mouse') {
      const isRightButton = e.button === 2

      this.dispatchEvent(e, isRightButton ? 'rightup' : 'mouseup')
    }
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
