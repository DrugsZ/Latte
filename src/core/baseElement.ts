export interface IRectBBox {
  x: number
  y: number
  width: number
  height: number
}

abstract class BaseElement {
  type:string
  private _id:string
  protected _elementData:CditorElement

  constructor(element:CditorElement){
    this.type = element.type
    this._id = element.id
    this._elementData = element
  }

  abstract getBoundingClientRect():IRectBBox

  abstract render(ctx:CanvasRenderingContext2D):void

  getFills(){
    const { fills } = this._elementData
    let colorStr = ''
    fills.forEach(item => {
      if(item.type === 'SOLID'){
        const { color } = item
        colorStr = `rgb(${255 * color.r}, ${255 * color.g}, ${255 * color.b})`
      }
    })
    return colorStr
  }
}

export default BaseElement