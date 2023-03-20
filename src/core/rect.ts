import BaseElement from 'Cditor/core/baseElement'

class Rect extends BaseElement {
  render(ctx: CanvasRenderingContext2D): void {
    const { size, transform } = this._elementData
    const { a, b, c, d, tx: x, ty: y } = transform
    const { x: width, y: height } = size
    ctx.fillStyle = this.getFills()
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.translate(centerX, centerY)
    ctx.transform(a, b, c, d, 0, 0)
    ctx.fillRect(-width / 2, -height / 2, width, height)
  }
}

export default Rect
