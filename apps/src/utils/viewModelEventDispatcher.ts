import { Emitter } from 'Latte/utils/event'
import type { ViewEvent } from 'Latte/view/viewEvents'
import type { ViewEventHandler } from 'Latte/core/viewParts/base/viewEventHandler'

export class ViewModelEventDispatcher {
  private readonly _onEvent = new Emitter<ViewEvent>()
  public readonly onEvent = this._onEvent.event

  private _eventHandlers: ViewEventHandler[] = []
  private _viewEventQueue: ViewEvent[] | null = null
  private _isConsumingViewEventQueue: boolean

  public addViewEventHandler(eventHandler: ViewEventHandler): void {
    for (let i = 0, len = this._eventHandlers.length; i < len; i++) {
      if (this._eventHandlers[i] === eventHandler) {
        console.warn(
          'Detected duplicate listener in ViewEventDispatcher',
          eventHandler
        )
      }
    }
    this._eventHandlers.push(eventHandler)
  }

  public removeViewEventHandler(eventHandler: ViewEventHandler): void {
    for (let i = 0; i < this._eventHandlers.length; i++) {
      if (this._eventHandlers[i] === eventHandler) {
        this._eventHandlers.splice(i, 1)
        break
      }
    }
  }

  public emitViewEvent(events: ViewEvent): void {
    if (this._viewEventQueue) {
      this._viewEventQueue = this._viewEventQueue.concat(events)
    } else {
      this._viewEventQueue = [events]
    }

    if (!this._isConsumingViewEventQueue) {
      this._consumeViewEventQueue()
    }
  }

  private _consumeViewEventQueue(): void {
    try {
      this._isConsumingViewEventQueue = true
      this._doConsumeQueue()
    } finally {
      this._isConsumingViewEventQueue = false
    }
  }

  private _doConsumeQueue(): void {
    while (this._viewEventQueue) {
      // Empty event queue, as events might come in while sending these off
      const events = this._viewEventQueue
      this._viewEventQueue = null

      // Use a clone of the event handlers list, as they might remove themselves
      const eventHandlers = this._eventHandlers.slice(0)
      eventHandlers.forEach(eventHandler => {
        eventHandler.handleEvents(events)
      })
    }
  }
}
