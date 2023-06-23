import View from 'Latte/core/view'

class MouseHandler {
  private _isMouseDown: boolean
  constructor(
    private readonly _element: Element,
    private readonly _view: View
  ) {
    this._bindMouseDownHandler()
    this._bindMouseMoveHandler()
    this._bindMouseUpHandler()
  }

  private _bindMouseDownHandler() {
    this._element.addEventListener('mousedown', () => {
      this._isMouseDown = true
    })
  }

  private _bindMouseUpHandler() {
    this._element.addEventListener('mouseup', () => {
      this._isMouseDown = false
    })
  }

  private _bindMouseMoveHandler() {
    this._element.addEventListener('mousemove', e => {
      if (!this._isMouseDown) {
        return
      }
      const newX = (e as MouseEvent).movementX
      const newY = (e as MouseEvent).movementY
      const currentCamera = this._view.getCurrentCamera()
      currentCamera.move(newX, newY)
    })
  }
}

export default MouseHandler
