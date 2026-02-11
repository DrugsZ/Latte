import type { IDisposable } from '@latte-js/bean'
export type { IDisposable }

export class DisposableStore implements IDisposable {
  private readonly _toDispose = new Set<IDisposable>()
  private _isDisposed = false

  public dispose(): void {
    if (this._isDisposed) {
      return
    }

    this._isDisposed = true
    this.clear()
  }

  public clear(): void {
    if (this._toDispose.size === 0) {
      return
    }

    try {
      this._toDispose.forEach(t => t.dispose())
    } finally {
      this._toDispose.clear()
    }
  }

  public add<T extends IDisposable>(t: T): T {
    if (!t) {
      return t
    }
    if ((t as unknown as DisposableStore) === this) {
      throw new Error('Cannot register a disposable on itself!')
    }

    if (this._isDisposed) {
      console.warn(
        new Error(
          'Registering disposable on object that has already been disposed of'
        ).stack
      )
      t.dispose()
    } else {
      this._toDispose.add(t)
    }

    return t
  }
}

export abstract class Disposable implements IDisposable {
  private readonly _store = new DisposableStore()

  public dispose(): void {
    this._store.dispose()
  }

  protected _register<T extends IDisposable>(t: T): T {
    if ((t as unknown as Disposable) === this) {
      throw new Error('Cannot register a disposable on itself!')
    }
    return this._store.add(t)
  }
}

class FunctionDisposable implements IDisposable {
  private _isDisposed: boolean
  private readonly _fn: () => void

  constructor(fn: () => void) {
    this._isDisposed = false
    this._fn = fn
  }

  dispose() {
    if (this._isDisposed) {
      return
    }
    if (!this._fn) {
      throw new Error(
        `Unbound disposable context: Need to use an arrow function to preserve the value of this`
      )
    }
    this._isDisposed = true
    this._fn()
  }
}

export function toDisposable(fn: () => void): IDisposable {
  return new FunctionDisposable(fn)
}
