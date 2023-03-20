abstract class BaseElement<T extends BaseNodeSchema = BaseNodeSchema> {
  type: string
  private _id: DefaultIDType
  protected _elementData: T

  constructor(element: T) {
    this.type = element.type
    this._id = element.guid
    this._elementData = element
  }

  getBoundingClientRect(): RectBBox {
    const { size, transform } = this._elementData
    const { tx: x, ty: y } = transform
    const { x: width, y: height } = size
    return {
      x,
      y,
      width,
      height,
    }
  }

  abstract render(ctx: CanvasRenderingContext2D): void

  getFills() {
    const { fills } = this._elementData
    let colorStr = ''
    if (!fills) return colorStr
    fills.forEach((item) => {
      if (item.type === 'SOLID') {
        const { color } = item
        colorStr = `rgb(${255 * color.r}, ${255 * color.g}, ${255 * color.b})`
      }
    })
    return colorStr
  }

  getGuidKey() {
    const { guid } = this._elementData
    return JSON.stringify(guid)
  }
}

export abstract class HightBaseElement<
  T extends BaseNodeSchema = BaseNodeSchema
> extends BaseElement<T> {
  protected _children: BaseElement<BaseNodeSchema>[] = []

  getBoundingClientRect() {
    const bBox: RectBBox = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }
    this._children.forEach((element) => {
      const elementBBox = element.getBoundingClientRect()
      bBox.x = Math.min(bBox.x, elementBBox.x)
      bBox.y = Math.min(bBox.y, elementBBox.y)
      bBox.width = Math.max(bBox.width, elementBBox.width + elementBBox.x)
      bBox.height = Math.max(bBox.height, elementBBox.height + elementBBox.y)
    })
    bBox.width -= bBox.x
    bBox.height -= bBox.y
    return bBox
  }

  getChildren() {
    return this._children
  }

  pushChild(...child: BaseElement[]) {
    this._children?.push(...child)
  }

  removeChild(removeChild: BaseElement) {
    this._children = this._children?.filter(
      (child) => !Object.is(child, removeChild)
    )
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { size, transform } = this._elementData
    const { a, b, c, d, tx: x, ty: y } = transform
    const { x: width, y: height } = size
    ctx.fillStyle = this.getFills()
    ctx.fillRect(x, y, width, height)
    if (this._children.length) {
      const centerX = x + width / 2
      const centerY = y + height / 2
      ctx.translate(centerX, centerY)
      ctx.transform(a, b, c, d, 0, 0)
      this._children.forEach((element) => {
        ctx.save()
        element.render(ctx)
        ctx.restore()
      })
    }
  }
}

export default BaseElement
