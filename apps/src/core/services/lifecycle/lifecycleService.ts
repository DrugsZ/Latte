export const enum LifecyclePhase {
  Starting = 1,

  Ready,

  Destroy,
}

export interface IDisposable {
  dispose(): void
}

export abstract class Disposable implements IDisposable {
  public dispose(): void {
    console.log(`${this} whose to be disposed`)
  }
}

export class Barrier {
  private _isOpen: boolean
  private _promise: Promise<boolean>
  private _completePromise!: (v: boolean) => void

  constructor() {
    this._isOpen = false
    this._promise = new Promise<boolean>((c, e) => {
      this._completePromise = c
    })
  }

  isOpen(): boolean {
    return this._isOpen
  }

  open(): void {
    this._isOpen = true
    this._completePromise(true)
  }

  wait(): Promise<boolean> {
    return this._promise
  }
}

export interface ILifecycleService {
  phase: LifecyclePhase

  when(phase: LifecyclePhase): Promise<void>
}

export class LifecycleService extends Disposable implements ILifecycleService {
  private _phase: LifecyclePhase = LifecyclePhase.Starting

  private _phaseWhen: Map<LifecyclePhase, Barrier> = new Map()

  get phase(): LifecyclePhase {
    return this._phase
  }

  set phase(value: LifecyclePhase) {
    if (value < this.phase) {
      throw new Error('Lifecycle cannot go backwards')
    }

    if (this._phase === value) {
      return
    }
    this._phase = value

    const barrier = this._phaseWhen.get(this._phase)
    if (barrier) {
      barrier.open()
      this._phaseWhen.delete(this._phase)
    }
  }

  public async when(phase: LifecyclePhase): Promise<void> {
    if (this._phase >= phase) {
      return Promise.resolve()
    }

    let barrier = this._phaseWhen.get(phase)
    if (!barrier) {
      barrier = new Barrier()
      this._phaseWhen.set(phase, barrier)
    }

    return barrier.wait() as unknown as Promise<void>
  }
}
