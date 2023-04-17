class RenderService {
  constructor(private readonly _canvas: HTMLCanvasElement) {}

  public draw(renderObjects: RenderObject[], renderBox: Rectangle) {
    const ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height)
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
}

export default RenderService
