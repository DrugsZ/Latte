import BaseElement from 'Cditor/core/baseElement'

class Rect extends BaseElement {
  static TYPE = 'rect'
  render() {
    const { size, transform } = this._elementData
    const { a, b, c, d, tx: x, ty: y } = transform
    const { x: width, y: height } = size

    return {
      type: Rect.TYPE,
      x,
      y,
      width,
      height,
      transform: [a, b, c, d, 0, 0],
      fills: this.getFills(),
    }
  }
}

export default Rect
