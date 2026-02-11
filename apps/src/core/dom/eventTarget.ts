import { isBoolean, isObject, isFunction } from 'Latte/utils/assert'
import EventEmitter from 'eventemitter3'
import type { IEventTarget } from 'Latte/core/dom/interfaces'

/**
 * Objects that can receive events and may have listeners for them.
 * eg. Element, Canvas, DisplayObject
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */
export class EventTarget implements IEventTarget {
  /**
   * event emitter
   */
  emitter = new EventEmitter()

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
      this.emitter.once(currentType, bindListener, context)
    } else {
      this.emitter.on(currentType, bindListener, context)
    }

    return this
  }
  removeAllEventListeners() {
    this.emitter.removeAllListeners()
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

    this.emitter.off(currentType, bindListener, context)

    return this
  }
}
