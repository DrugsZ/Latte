import { ViewPart } from 'Latte/view/viewPart'
import type { ViewModel } from 'Latte/core/viewModel'
import type { Camera } from 'Latte/core/cameraService'
import 'Latte/view/viewCursor.css'

export class ViewCursor extends ViewPart {
  constructor(
    viewModel: ViewModel,
    private readonly _renderDOM: HTMLCanvasElement
  ) {
    super(viewModel)
    this._renderDOM.className = 'latte-cursor'
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {}
}
