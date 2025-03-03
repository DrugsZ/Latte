import { ViewEventHandler } from 'Latte/core/viewParts/base/viewEventHandler'
import type { Camera } from 'Latte/core/services/camera/cameraService'
import type { ViewModel } from 'Latte/core/viweModel/viewModel'

export abstract class ViewPart extends ViewEventHandler {
  protected _context: ViewModel

  constructor(_context: ViewModel) {
    super()
    this._context = _context
    this._context.addViewEventHandler(this)
  }
  public abstract render(ctx: CanvasRenderingContext2D, camera: Camera): void
}
