class RenderService {
  private _ctx: CanvasRenderingContext2D
  constructor(private readonly _canvas: HTMLCanvasElement) {
    this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D
  }

  public draw(
    renderObjects: RenderObject[],
    renderBox: Rectangle,
    zoom: number
  ): void {
    this._clearDrawArea()
    const ctx = this._ctx
    ctx.scale(zoom, zoom)
    ctx.translate(-renderBox.x, -renderBox.y)
    renderObjects.forEach(item => {
      ctx.save()
      const { x, y, width, height, transform, fills } = item
      const [a, b, c, d] = transform
      ctx.fillStyle = fills
      const centerX = x + width / 2
      const centerY = y + height / 2
      ctx.translate(centerX, centerY)
      ctx.transform(a, b, c, d, 0, 0)
      ctx.translate(-centerX, -centerY)
      ctx.fillRect(x, y, width, height)
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
    ctx.clearRect(area.x, a.y, area.width, area.height)
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, area.width, area.height)
  }
}

export default RenderService
