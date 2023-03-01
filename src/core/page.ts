import BaseElement,{ IRectBBox } from 'Cditor/core/baseElement'
import Rect from 'Cditor/core/rect'
import Viewport from 'Cditor/core/viewport'


class Page {
  private _model: PAGE
  id:string
  private _offScreenCanvas: OffscreenCanvas
  private _elements:BaseElement[] = []
  private _viewport:Viewport

  constructor(model:PAGE, offsetCanvas: OffscreenCanvas){
    this._model = model
    this.id = model.id
    this._offScreenCanvas = offsetCanvas
    this._initElement()
    this._initViewport()
  }


  private _initElement(){
    const { children } = this._model
    children.forEach(child => {
      if(child.type === 'RECTANGLE'){
        this._elements.push(new Rect(child))
      }
    })
  }

  private getAllElementsBBox(){
    const bBox:IRectBBox = {
      x:0,
      y:0,
      width:this._offScreenCanvas.width,
      height:this._offScreenCanvas.height
    }

    this._elements.forEach(element =>{
      const elementBBox = element.getBoundingClientRect()
      bBox.x = Math.min(bBox.x, elementBBox.x)
      bBox.y = Math.min(bBox.y, elementBBox.y)
      bBox.width = Math.max(bBox.width, elementBBox.width + elementBBox.x - bBox.x)
      bBox.height = Math.max(bBox.height, elementBBox.height + elementBBox.y - bBox.y)
    })

    return bBox
  }

  private _initViewport(){
    const bBox = this.getAllElementsBBox()
    const { x, y } = bBox
    const canvasSize = {
      width:this._offScreenCanvas.width,
      height:this._offScreenCanvas.height
    }
    const xZoom = canvasSize.width / bBox.width
    const yZoom = canvasSize.height / bBox.height
    const zoom = Math.min(xZoom, yZoom)
    this._viewport = new Viewport({
      x: -x,
      y: -y,
      zoom
    })
    this._viewport.onViewportChange(this.renderPage, this)
  }

  private _renderElements(){
    const ctx = this._offScreenCanvas.getContext('2d') as unknown as  CanvasRenderingContext2D
    const viewportInfo = this._viewport.getViewport()
    ctx.translate(viewportInfo.x, viewportInfo.y)
    ctx.scale(viewportInfo.zoom, viewportInfo.zoom)
    this._elements.forEach(element => {
      ctx.save()
      element.render(ctx)
      ctx.restore()
    })
  }

  renderPage(){
    const { backgrounds } = this._model
    const { color } = backgrounds[0]
    const fillColor = `rgb(${255 * color.r}, ${255 * color.g}, ${255 * color.b})`
    const ctx = this._offScreenCanvas.getContext('2d') as unknown as  CanvasRenderingContext2D
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this._offScreenCanvas.width, this._offScreenCanvas.height)
    ctx.fillStyle = fillColor
    ctx.fillRect(0, 0, this._offScreenCanvas.width, this._offScreenCanvas.height)
    this._renderElements()
  }
}


export default Page