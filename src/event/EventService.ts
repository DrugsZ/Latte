/* eslint-disable no-param-reassign */
import { FederatedEvent } from 'Latte/core/FederatedEvent'
import { FederatedMouseEvent } from 'Latte/core/FederatedMouseEvent'
import { FederatedPointerEvent } from 'Latte/core/FederatedPointerEvent'
import { FederatedWheelEvent } from 'Latte/core/FederatedWheelEvent'
import type { IEventTarget } from 'Latte/core/interfaces'
import { Point } from 'Latte/common/Point'
import { isDisplayObject } from 'Latte/utils/assert'

type Picker = (event: Point) => IEventTarget | null
type TrackingData = {
  pressTargetsByButton: Record<number, IEventTarget[]>
  clicksByButton: Record<
    number,
    {
      clickCount: number
      target: IEventTarget
      timeStamp: number
    }
  >
  overTargets: IEventTarget[] | null
}

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

  private _mappingState: Record<string, any> = {
    trackingData: {},
  }

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
    if (!this._rootTarget) {
      return
    }

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
    this._addEventMapping('pointerup', this._onPointerUp)
    this._addEventMapping('pointermove', this._onPointerMove)
    this._addEventMapping('pointerout', this._onPointerOut)
    this._addEventMapping('pointerleave', this._onPointerOut)
    this._addEventMapping('pointerover', this._onPointerOver)
    this._addEventMapping('pointerupoutside', this._onPointerUpOutside)
    this._addEventMapping('wheel', this._onWheel)
  }

  clonePointerEvent(
    from: FederatedPointerEvent,
    type?: string
  ): FederatedPointerEvent {
    const event = this._allocateEvent(FederatedPointerEvent)

    event.nativeEvent = from.nativeEvent
    event.originalEvent = from.originalEvent

    EventService.copyPointerData(from, event)
    EventService.copyMouseData(from, event)
    EventService.copyData(from, event)

    event.target = from.target
    event.path = from.composedPath().slice()
    event.type = type ?? event.type

    return event
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

  private _allocateEvent<T extends FederatedEvent>(constructor: {
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

  private _freeEvent<T extends FederatedEvent>(event: T) {
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

  private _notifyTarget(e: FederatedEvent, type?: string) {
    type = type ?? e.type
    const key =
      e.eventPhase === e.CAPTURING_PHASE || e.eventPhase === e.AT_TARGET
        ? `${type}capture`
        : type

    this._notifyListeners(e, key)

    if (e.eventPhase === e.AT_TARGET) {
      this._notifyListeners(e, type)
    }
  }

  private _notifyListeners(e: FederatedEvent, type: string) {
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
    const event = this._allocateEvent(FederatedPointerEvent)

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
    const event = this._allocateEvent(FederatedWheelEvent)

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
      this._notifyListeners(e, type)
    }
  }

  propagate(e: FederatedEvent, type?: string) {
    if (!e.target) {
      return
    }
    // [target, parent, root]
    const composedPath = e.composedPath()

    // event flow: capture -> target -> bubbling

    // capture phase
    e.eventPhase = e.CAPTURING_PHASE
    for (let i = composedPath.length - 1; i >= 1; i--) {
      e.currentTarget = composedPath[i]
      this._notifyTarget(e, type)
      if (e.propagationStopped || e.propagationImmediatelyStopped) return
    }

    // target phase
    e.eventPhase = e.AT_TARGET
    e.currentTarget = e.target
    this._notifyTarget(e, type)
    if (e.propagationStopped || e.propagationImmediatelyStopped) return

    // find current target in composed path
    const index = composedPath.indexOf(e.currentTarget)

    // bubbling phase
    e.eventPhase = e.BUBBLING_PHASE
    for (let i = index + 1; i < composedPath.length; i++) {
      e.currentTarget = composedPath[i]
      this._notifyTarget(e, type)
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

    return propagationPath
  }

  private _trackingData(id: number): TrackingData {
    if (!this._mappingState.trackingData[id]) {
      this._mappingState.trackingData[id] = {
        pressTargetsByButton: {},
        clicksByButton: {},
        overTarget: null,
      }
    }

    return this._mappingState.trackingData[id]
  }

  private _findMountedTarget(
    propagationPath: IEventTarget[] | null
  ): IEventTarget | null {
    if (!propagationPath) {
      return null
    }

    let currentTarget = propagationPath[propagationPath.length - 1]
    for (let i = propagationPath.length - 2; i >= 0; i--) {
      const target = propagationPath[i]
      if (
        target === this._rootTarget ||
        (isDisplayObject(target) && target.parentNode === currentTarget)
      ) {
        currentTarget = propagationPath[i]
      } else {
        break
      }
    }

    return currentTarget
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
    const trackingData = this._trackingData(from.pointerId)

    trackingData.pressTargetsByButton[from.button] = e.composedPath()
    this._freeEvent(e)
  }

  private _onPointerMove = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const e = await this._createPointerEvent(from)
    this.dispatchEvent(e, 'pointermove')
    if (e.pointerType === 'mouse') {
      const isRightButton = e.button === 2

      this.dispatchEvent(e, isRightButton ? 'rightmove' : 'mousemove')
    }
    this._freeEvent(e)
  }

  private _onPointerUp = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const now = performance.now()
    const e = await this._createPointerEvent(from)
    this.dispatchEvent(e, 'pointerup')
    if (e.pointerType === 'mouse') {
      const isRightButton = e.button === 2

      this.dispatchEvent(e, isRightButton ? 'rightup' : 'mouseup')
    }
    const trackingData = this._trackingData(from.pointerId)
    const pressTarget = this._findMountedTarget(
      trackingData.pressTargetsByButton[from.button]
    )

    let clickTarget = pressTarget

    // pointerupoutside only bubbles. It only bubbles upto the parent that doesn't contain
    // the pointerup location.
    if (pressTarget && !e.composedPath().includes(pressTarget)) {
      let currentTarget: IEventTarget | null = pressTarget

      while (currentTarget && !e.composedPath().includes(currentTarget)) {
        e.currentTarget = currentTarget

        this._notifyTarget(e, 'pointerupoutside')

        if (e.pointerType === 'touch') {
          this._notifyTarget(e, 'touchendoutside')
        } else if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
          const isRightButton = e.button === 2

          this._notifyTarget(
            e,
            isRightButton ? 'rightupoutside' : 'mouseupoutside'
          )
        }

        if (isDisplayObject(currentTarget)) {
          currentTarget = currentTarget.parentNode
        }
      }

      delete trackingData.pressTargetsByButton[from.button]

      // currentTarget is the most specific ancestor holding both the pointerdown and pointerup
      // targets. That is - it's our click target!
      clickTarget = currentTarget
    }

    if (clickTarget) {
      const clickEvent = this.clonePointerEvent(e, 'click')

      clickEvent.target = clickTarget
      clickEvent.path = []

      if (!trackingData.clicksByButton[from.button]) {
        trackingData.clicksByButton[from.button] = {
          clickCount: 0,
          target: clickEvent.target,
          timeStamp: now,
        }
      }

      const clickHistory = trackingData.clicksByButton[from.button]

      if (
        clickHistory.target === clickEvent.target &&
        now - clickHistory.timeStamp < 200
      ) {
        ++clickHistory.clickCount
      } else {
        clickHistory.clickCount = 1
      }

      clickHistory.target = clickEvent.target
      clickHistory.timeStamp = now

      clickEvent.detail = clickHistory.clickCount

      // @see https://github.com/antvis/G/issues/1091
      if (!e.detail?.preventClick) {
        if (
          clickEvent.pointerType === 'mouse' ||
          clickEvent.pointerType === 'touch'
        ) {
          this.dispatchEvent(clickEvent, 'click')
        }
        this.dispatchEvent(clickEvent, 'pointertap')
      }

      this._freeEvent(clickEvent)
    }

    this._freeEvent(e)
  }

  private _onPointerOut = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }
    const trackingData = this._trackingData(from.pointerId)

    if (trackingData.overTargets) {
      const isMouse = from.pointerType === 'mouse' || from.pointerType === 'pen'
      const outTarget = this._findMountedTarget(trackingData.overTargets)

      // pointerout first
      const outEvent = await this._createPointerEvent(
        from,
        'pointerout',
        outTarget || undefined
      )

      this.dispatchEvent(outEvent, 'pointerout')
      if (isMouse) this.dispatchEvent(outEvent, 'mouseout')

      // pointerleave(s) are also dispatched b/c the pointer must've left rootTarget and its descendants to
      // get an upstream pointerout event (upstream events do not know rootTarget has descendants).
      const leaveEvent = await this._createPointerEvent(
        from,
        'pointerleave',
        outTarget || undefined
      )

      leaveEvent.eventPhase = leaveEvent.AT_TARGET

      while (
        leaveEvent.target &&
        leaveEvent.target !==
          (isDisplayObject(this._rootTarget) && this._rootTarget.parentNode)
      ) {
        leaveEvent.currentTarget = leaveEvent.target

        this._notifyTarget(leaveEvent)
        if (isMouse) {
          this._notifyTarget(leaveEvent, 'mouseleave')
        }

        if (isDisplayObject(leaveEvent.target)) {
          leaveEvent.target = leaveEvent.target.parentNode
        }
      }

      trackingData.overTargets = null

      this._freeEvent(outEvent)
      this._freeEvent(leaveEvent)
    }
  }
  private _onPointerOver = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const trackingData = this._trackingData(from.pointerId)
    const e = await this._createPointerEvent(from)

    const isMouse = e.pointerType === 'mouse' || e.pointerType === 'pen'

    this.dispatchEvent(e, 'pointerover')
    if (isMouse) this.dispatchEvent(e, 'mouseover')

    // pointerenter events must be fired since the pointer entered from upstream.
    const enterEvent = this.clonePointerEvent(e, 'pointerenter')

    enterEvent.eventPhase = enterEvent.AT_TARGET

    while (
      enterEvent.target &&
      enterEvent.target !==
        (isDisplayObject(this._rootTarget) && this._rootTarget.parentNode)
    ) {
      enterEvent.currentTarget = enterEvent.target

      this._notifyTarget(enterEvent)
      if (isMouse) {
        // mouseenter should not bubble
        // @see https://developer.mozilla.org/en-US/docs/Web/API/Element/mouseenter_event#usage_notes
        this._notifyTarget(enterEvent, 'mouseenter')
      }

      if (isDisplayObject(enterEvent.target)) {
        enterEvent.target = enterEvent.target.parentNode
      }
    }

    trackingData.overTargets = e.composedPath()

    this._freeEvent(e)
    this._freeEvent(enterEvent)
  }
  private _onPointerUpOutside = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedPointerEvent)) {
      return
    }

    const trackingData = this._trackingData(from.pointerId)
    const pressTarget = this._findMountedTarget(
      trackingData.pressTargetsByButton[from.button]
    )
    const e = await this._createPointerEvent(from)

    if (pressTarget) {
      let currentTarget: IEventTarget | null = pressTarget

      while (currentTarget) {
        e.currentTarget = currentTarget

        this._notifyTarget(e, 'pointerupoutside')

        if (e.pointerType === 'touch') {
          // this.notifyTarget(e, 'touchendoutside');
        } else if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
          this._notifyTarget(
            e,
            e.button === 2 ? 'rightupoutside' : 'mouseupoutside'
          )
        }

        if (isDisplayObject(currentTarget)) {
          currentTarget = currentTarget.parentNode
        }
      }

      delete trackingData.pressTargetsByButton[from.button]
    }

    this._freeEvent(e)
  }
  private _onWheel = async (from: FederatedEvent) => {
    if (!(from instanceof FederatedWheelEvent)) {
      return
    }

    const wheelEvent = await this._createWheelEvent(from)

    this.dispatchEvent(wheelEvent, 'wheel')
    this._freeEvent(wheelEvent)
  }
}
