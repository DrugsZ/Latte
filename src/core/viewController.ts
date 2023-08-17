import type { ViewModel } from 'Latte/core/viewModel'
import type { ViewMouseModeType } from 'Latte/core/viewMouseMode'

export class ViewController {
  constructor(private _viewMode: ViewModel) {}
  public selectElement() {}
  public hoverElement() {}
  public hoverSelectBox() {}
  public resizeElement() {}
  public moveElement() {}
  public rotateElement() {}
  public moveCamera() {}
  public zoomCamera() {}
  public changeViewMouseMove(mode: ViewMouseModeType) {
    this._viewMode.setMouseMode(mode)
  }
}
