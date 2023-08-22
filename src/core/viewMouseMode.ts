export enum ViewMouseModeType {
  None,
  DragCamera,
  ZoomCamera,
  CreateRect,
  CreateEllipse,
}

export class ViewMouseMode {
  private _mode: ViewMouseModeType = ViewMouseModeType.None

  setMode(mode: ViewMouseModeType) {
    this._mode = mode
  }

  getMode() {
    return this._mode
  }
}
