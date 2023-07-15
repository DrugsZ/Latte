import type View from 'Latte/core/View'

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
      const vpMatrix = currentCamera.getViewPortMatrix()
      currentCamera.move(-newX / vpMatrix[0], -newY / vpMatrix[3])
    })
  }
}

export default MouseHandler
