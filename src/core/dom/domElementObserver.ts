import { Disposable } from 'Latte/core/services/lifecycle/lifecycleService'
import { Emitter } from 'Latte/common/event'

class DomElementObserver extends Disposable {
  private _domCacheWidth: number
  private _domCacheHeight: number
  private readonly _onDOMWheel = new Emitter<WheelEvent>()
  public readonly onDOMWheel = this._onDOMWheel.event
  private readonly _onResize = new Emitter<UIEvent>()
  public readonly onResize = this._onResize.event
  constructor(private readonly _domElement: HTMLElement) {
    super()
    this._initDOMSize()
    this._initEventListener()
  }

  get canvasSize() {
    return {
      width: this._domCacheWidth,
      height: this._domCacheHeight,
    }
  }

  private _updateSizeCache() {
    const rect = this._domElement.getBoundingClientRect()
    this._domCacheWidth = rect.width
    this._domCacheHeight = rect.height
  }
  private _initDOMSize() {
    this._updateSizeCache()
  }

  private _initEventListener() {
    this._domElement.addEventListener('wheel', this._onDOMWheel.fire)
    this._domElement.addEventListener('resize', this._onResize.fire)
  }

  public override dispose(): void {
    this._domElement.removeEventListener('wheel', this._onDOMWheel.fire)
    this._domElement.removeEventListener('resize', this._onResize.fire)
    super.dispose()
  }
}

export default DomElementObserver
