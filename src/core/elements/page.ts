import type DisplayObject from 'Latte/core/elements/container'
import { Container } from 'Latte/core/elements/container'

export class Page extends Container {
  private _visibleElements: DisplayObject[]

  public getVisibleElementRenderObjects() {
    if (!this._visibleElements) {
      this._visibleElements = this._children.filter(child => child.visible)
    }
    return this._visibleElements
  }

  public setVisibleArea(value: Rectangle) {
    const {
      x: visibleX,
      y: visibleY,
      width: visibleWidth,
      height: visibleHeight,
    } = value
    this._visibleElements = this._children.filter(child => {
      if (!child.visible) {
        return false
      }
      const childRect = child.getBoundingClientRect()
      const { x, y, width, height } = childRect
      const xIsVisible = x < visibleX + visibleWidth && x + width > visibleX
      const yIsVisible = y < visibleY + visibleHeight && y + height > visibleY
      return xIsVisible && yIsVisible
    })
  }
}
