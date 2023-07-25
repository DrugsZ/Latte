import { Bounds } from 'Latte/core/Bounds'
import type { DisplayObject } from 'Latte/core/DisplayObject'
import { ViewPart } from 'Latte/view/ViewPart'

export class SelectBox extends ViewPart {
  private _renderBounds: Bounds = new Bounds()
  private _boundDirty: boolean = true
  private _selectElements: DisplayObject[] = []

  getBounds() {
    if (this._boundDirty) {
      this._renderBounds.clear()
      this._updateBounds()
    }
    return this._renderBounds
  }

  private _updateBounds() {
    this._selectElements.forEach(element => {
      if (!element.visible) {
        return
      }
      const elementBBox = element.getBounds()
      this._renderBounds.merge(elementBBox)
    })
    this._boundDirty = false
  }

  addOrRemoveElement(displayObject: DisplayObject) {
    if (this._selectElements.includes(displayObject)) {
      this._selectElements = this._selectElements.filter(
        item => item !== displayObject
      )
    } else {
      this._selectElements.push(displayObject)
    }
    this._boundDirty = true
    this.setShouldRender()
  }

  render(ctx: CanvasRenderingContext2D) {
    const rect = this.getBounds().getRectangle()
    ctx.strokeStyle = 'red'
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  }
}
