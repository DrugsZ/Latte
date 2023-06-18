import type { IBaseRenderObject } from 'Cditor/core/DisplayObject'
import { DisplayObject, EditorElementTypeKind } from 'Cditor/core/DisplayObject'
import { registerEditorShapeRender } from 'Cditor/core/RenderContributionRegistry'

export interface IRectRenderObject extends IBaseRenderObject {
  width: number
  height: number
}
class Rect extends DisplayObject {
  static TYPE = EditorElementTypeKind.RECTANGLE
  render(): IRectRenderObject {
    const { size } = this._elementData
    const { x, y } = this.getPosition()
    const { x: width, y: height } = size

    return {
      type: Rect.TYPE,
      x,
      y,
      width,
      height,
      transform: this.getWorldTransform(),
      fills: this.getFills(),
    }
  }
}

export default Rect

registerEditorShapeRender(
  EditorElementTypeKind.RECTANGLE,
  (renderObject: IRectRenderObject, ctx) => {
    const { x, y, width, height, transform } = renderObject
    const { a, b, c, d } = transform
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.translate(centerX, centerY)
    ctx.transform(a, b, c, d, 0, 0)
    ctx.translate(-centerX, -centerY)
    ctx.rect(x, y, width, height)
  }
)
