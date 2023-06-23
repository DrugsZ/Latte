import { DisplayObject, EditorElementTypeKind } from 'Latte/core/DisplayObject'

class Rect extends DisplayObject<RectangleElement> {
  static TYPE = EditorElementTypeKind.RECTANGLE

  getBorder() {
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
