import type { IBaseRenderObject } from 'Cditor/core/DisplayObject'
import { DisplayObject, EditorElementTypeKind } from 'Cditor/core/DisplayObject'

export interface IEllipseRenderObject extends IBaseRenderObject {
  radiusX: number
  radiusY: number
}
class Ellipse extends DisplayObject {
  static TYPE = EditorElementTypeKind.ELLIPSE
  render(): IEllipseRenderObject {
    const { size } = this._elementData
    const { x, y } = this.getPosition()
    const { x: width, y: height } = size

    return {
      type: Ellipse.TYPE,
      x,
      y,
      radiusX: width / 2,
      radiusY: height / 2,
      transform: this.getWorldTransform(),
      fills: this.getFills(),
    }
  }
}

export default Ellipse
