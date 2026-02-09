import type { IDisposable } from '@latte-js/bean'
import { LinkedList } from '../linkedList/linkedList'
import { toDisposable } from '../lifecycle'

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any): IDisposable
}

class Listener<T> {
  constructor(
    readonly callback: (e: T) => void,
    readonly callbackThis: any | undefined
  ) {}

  invoke(e: T) {
    this.callback.call(this.callbackThis, e)
  }
}

export class Emitter<T> implements IDisposable {
  private _event?: Event<T>
  protected _listeners?: LinkedList<Listener<T>>
  // private _deliveryQueue: {
  // 	listener: Listener<T>
  // 	event: T
  // }[]

  dispose(): void {
    if (this._listeners) {
      this._listeners.clear()
      this._listeners = undefined
    }
  }

  get event(): Event<T> {
    if (!this._event) {
      this._event = (callback: (e: T) => any, thisArgs?: any) => {
        if (!this._listeners) {
          this._listeners = new LinkedList()
        }

        const listener = new Listener(callback, thisArgs)
        const removeListener = this._listeners.push(listener)

        return toDisposable(removeListener)
      }
    }
    return this._event
  }

  fire(event: T): void {
    if (this._listeners) {
      // put all [listener,event]-pairs into delivery queue
      // then emit all event. an inner/nested event might be
      // the driver of this
      for (const listener of this._listeners) {
        listener.invoke(event)
      }
    }
  }
}
