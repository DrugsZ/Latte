import { Bounds } from 'Latte/core/bounds'
import { DisplayObject } from 'Latte/core/displayObject'
import { ViewPart } from 'Latte/view/viewPart'
import type * as viewEvents from 'Latte/view/viewEvents'
import Page from 'Latte/core/page'
import { EditorDocument } from 'Latte/elements/document'
import type { FederatedPointerEvent } from 'Latte/core/federatedPointerEvent'

export class SelectBox extends ViewPart {
  private _renderBounds: Bounds = new Bounds()
  private _boundDirty: boolean = true
  private _selectElements: DisplayObject[] = []

  constructor(context) {
    super(context)
    this.onCanvasMouseDown = this.onCanvasMouseDown.bind(this)
  }

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

  public onCanvasMouseDown(e: FederatedPointerEvent) {
    const { target } = e
    if (target instanceof EditorDocument || target instanceof Page) {
      this._selectElements = []
      this._renderBounds.clear()
      this._boundDirty = true
      this.setShouldRender()
      return
    }
    if (target instanceof DisplayObject) {
      this.addOrRemoveElement(target)
    }
  }

  public override onCameraChange(): boolean {
    return true
  }

  public override onElementChange(
    event: viewEvents.ViewElementChangeEvent
  ): boolean {
    return true
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
    if (!this._selectElements.length) {
      return
    }
    const rect = this.getBounds().getRectangle()
    ctx.strokeStyle = 'red'
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  }
}
