import BaseElement from 'Cditor/core/baseElement'

class Rect extends BaseElement {
  getBoundingClientRect() {
    return {
      x: this._elementData.x,
      y: this._elementData.y,
      width: this._elementData.width,
      height: this._elementData.height,
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { x, y, height, width } = this._elementData
    ctx.fillStyle = this.getFills()
    const { relativeTransform } = this._elementData
    const [[a, c], [b, d]] = relativeTransform
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.translate(centerX, centerY)
    ctx.transform(a, b, c, d, 0, 0)
    ctx.fillRect(-width / 2, -height / 2, width, height)
  }
}

export default Rect
