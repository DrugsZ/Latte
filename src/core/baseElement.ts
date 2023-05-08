abstract class BaseElement<T extends BaseNodeSchema = BaseNodeSchema> {
  type: string
  private _id: string
  protected _elementData: T

  constructor(element: T) {
    this.type = element.type
    this._id = element.guid
    this._elementData = element
  }

  get id(): string {
    return JSON.stringify(this._id)
  }
  getBoundingClientRect(): Rectangle {
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

  abstract render(): RenderObject

  getFills() {
    const { fillPaints } = this._elementData
    let colorStr = ''
    if (!fillPaints) return colorStr
    fillPaints.forEach(item => {
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
    const bBox: Rectangle = {
      x: Infinity,
      y: Infinity,
      width: -Infinity,
      height: -Infinity,
    }
    this._children.forEach(element => {
      const elementBBox = element.getBoundingClientRect()
      bBox.x = Math.min(bBox.x, elementBBox.x)
      bBox.y = Math.min(bBox.y, elementBBox.y)
      bBox.width =
        Math.max(bBox.width + bBox.x, elementBBox.width + elementBBox.x) -
        bBox.x
      bBox.height =
        Math.max(bBox.height + bBox.y, elementBBox.height + elementBBox.y) -
        bBox.y
    })
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
      child => !Object.is(child, removeChild)
    )
  }

  render() {
    const { size, transform } = this._elementData
    const { a, b, c, d, tx: x, ty: y } = transform
    const { x: width, y: height } = size

    return {
      type: 'frame',
      x,
      y,
      width,
      height,
      transform: [a, b, c, d, 0, 0],
      fills: this.getFills(),
    }
  }
}

export default BaseElement
