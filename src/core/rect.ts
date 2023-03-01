import BaseElement from 'Cditor/core/baseElement'


class Rect extends BaseElement {

  getBoundingClientRect(){
    return {
      x:this._elementData.x,
      y:this._elementData.y,
      width:this._elementData.width,
      height:this._elementData.height
    }
  }

  render(ctx:CanvasRenderingContext2D): void {
    const {x, y, height, width} = this._elementData
    ctx.fillStyle = this.getFills()
    ctx.fillRect(x, y, width, height)
  }
}

export default Rect