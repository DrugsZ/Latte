import { ViewEventHandler } from 'Latte/view/viewEventHandler'
import type { Camera } from 'Latte/core/cameraService'
import type { ViewModel } from 'Latte/core/viewModel'

export abstract class ViewPart extends ViewEventHandler {
  private _context: ViewModel

  constructor(_context: ViewModel) {
    super()
    this._context = _context
    this._context.addViewEventHandler(this)
  }
  public abstract render(ctx: CanvasRenderingContext2D, camera: Camera): void
}
