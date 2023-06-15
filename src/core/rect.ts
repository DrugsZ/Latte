import type { IBaseRenderObject } from 'Cditor/core/DisplayObject'
import { DisplayObject } from 'Cditor/core/DisplayObject'

interface IRectRenderObject extends IBaseRenderObject {
  width: number
  height: number
}
class Rect extends DisplayObject {
  static TYPE = 'rect'
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
