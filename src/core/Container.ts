import { DisplayObject } from 'Cditor/core/DisplayObject'

export abstract class Container<
  T extends BaseNodeSchema = BaseNodeSchema
> extends DisplayObject<T> {
  protected _children: DisplayObject<BaseNodeSchema>[] = []

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

  addChild(...child: DisplayObject[]) {
    this._children?.push(...child)
    child.forEach(c => {
      c.parentNode = this
    })
  }

  removeChild(removeChild: DisplayObject) {
    this._children = this._children?.filter(child => {
      const willReserve = !Object.is(child, removeChild)
      if (!willReserve) {
        child.parentNode = null
        return false
      }
      return willReserve
    })
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

export default DisplayObject
