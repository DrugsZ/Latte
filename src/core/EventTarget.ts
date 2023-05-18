import { isBoolean, isObject, isFunction } from 'Cditor/utils/assert'
import EventEmitter from 'eventemitter3'
import { FederatedEvent } from 'Cditor/core/FederatedEvent'
import type { IEventTarget } from 'Cditor/core/interfaces'

/**
 * Objects that can receive events and may have listeners for them.
 * eg. Element, Canvas, DisplayObject
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */
export class EventTarget implements IEventTarget {
  /**
   * event emitter
   */
  private _emitter = new EventEmitter()

  /**
   * support `capture` & `once` in options
   * @see https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener
   */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((...args: any[]) => void),
    options?: boolean | AddEventListenerOptions
  ) {
    const capture =
      (isBoolean(options) && options) || (isObject(options) && options.capture)
    const once = isObject(options) && options.once
    const context = isFunction(listener) ? undefined : listener

    const currentType = capture ? `${type}capture` : type
    const bindListener = isFunction(listener) ? listener : listener.handleEvent

    if (once) {
      this._emitter.once(currentType, bindListener, context)
    } else {
      this._emitter.on(currentType, bindListener, context)
    }

    return this
  }
  removeAllEventListeners() {
    this._emitter.removeAllListeners()
  }
  removeEventListener(
    type: string,
    listener?: EventListenerOrEventListenerObject | ((...args: any[]) => void),
    options?: boolean | AddEventListenerOptions
  ) {
    const capture =
      (isBoolean(options) && options) || (isObject(options) && options.capture)
    const context = isFunction(listener) ? undefined : listener

    const currentType = capture ? `${type}capture` : type
    const bindListener = isFunction(listener) ? listener : listener.handleEvent

    this._emitter.off(currentType, bindListener, context)

    return this
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
   */
  dispatchEvent<T extends FederatedEvent>(
    e: T,
    skipPropagate = false
  ): boolean {
    if (!(e instanceof FederatedEvent)) {
      throw new Error(
        'DisplayObject cannot propagate events outside of the Federated Events API'
      )
    }

    return skipPropagate
  }
}
