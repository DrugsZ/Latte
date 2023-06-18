import { getEditorShapeRender } from 'Cditor/core/RenderContributionRegistry'
import { IBaseRenderObject } from 'Cditor/core/DisplayObject'

class RenderService {
  private _ctx: CanvasRenderingContext2D
  constructor(private readonly _canvas: HTMLCanvasElement) {
    this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D
  }

  public draw(
    renderObjects: IBaseRenderObject[],
    renderBox: Rectangle,
    zoom: number
  ): void {
    this._clearDrawArea()
    const ctx = this._ctx
    ctx.scale(zoom, zoom)
    ctx.translate(-renderBox.x, -renderBox.y)
    renderObjects.forEach(item => {
      ctx.save()
      const { fills } = item
      let colorStr = ''
      fills.forEach(i => {
        if (i.type === 'SOLID') {
          const { color } = i
          colorStr = `rgb(${255 * color.r}, ${255 * color.g}, ${255 * color.b})`
        }
      })
      ctx.beginPath()
      ctx.fillStyle = colorStr
      const shapeRender = getEditorShapeRender(item.type)
      shapeRender?.(item, ctx)
      ctx.fill()
      ctx.restore()
    })
  }

  private _clearDrawArea(
    area: Rectangle = {
      x: 0,
      y: 0,
      width: this._canvas.width,
      height: this._canvas.height,
    }
  ) {
    const ctx = this._ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(area.x, area.y, area.width, area.height)
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, area.width, area.height)
  }
}

export default RenderService
