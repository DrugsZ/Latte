import { DisplayObject } from 'Latte/core/displayObject'
import { EditorElementTypeKind } from 'Latte/constants/schema'

class Rect extends DisplayObject<RectangleElement> {
  static TYPE = EditorElementTypeKind.RECTANGLE

  getBorder(): number | [number, number, number, number] {
    const { cornerRadius } = this._elementData
    if (cornerRadius === 'MIXED') {
      return [
        this._elementData.topLeftRadius,
        this._elementData.topRightRadius,
        this._elementData.bottomLeftRadius,
        this._elementData.bottomRightRadius,
      ]
    }
    return cornerRadius
  }
}

export default Rect
