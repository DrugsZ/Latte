class DrawService {
  constructor(private readonly _canvas) {}

  public draw(renderObjects: RenderObject[]) {
    const ctx = this._canvas.getContext('2d')
    renderObjects.forEach((item) => {
      ctx.save()
      ctx.fills = item.fills
      const { x, y, width, height, transform, fills } = item
      const [a, b, c, d] = transform
      ctx.fillStyle = fills
      const centerX = x + width / 2
      const centerY = y + height / 2
      ctx.translate(centerX, centerY)
      ctx.transform(a, b, c, d, 0, 0)
      ctx.fillRect(-width / 2, -height / 2, width, height)
      ctx.restore()
    })
  }
}

export default DrawService
