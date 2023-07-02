import { DisplayObject } from 'Latte/core/DisplayObject'

export abstract class Container<
  T extends BaseNodeSchema = BaseNodeSchema
> extends DisplayObject<T> {
  protected _children: DisplayObject<BaseNodeSchema>[] = []

  getBoundingClientRect() {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    this._children.forEach(element => {
      const elementBBox = element.getBoundingClientRect()
      minX = Math.min(minX, elementBBox.x)
      minY = Math.min(minY, elementBBox.y)
      maxX = Math.max(maxX, elementBBox.x + elementBBox.width)
      maxY = Math.max(maxY, elementBBox.y + elementBBox.height)
    })
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    } as Rectangle
  }

  getChildren() {
    return this._children
  }

  appendChild(...child: DisplayObject[]) {
    this._children?.push(...child)
    child.forEach(c => {
      c.parentNode?.removeChild(c)
      c.parentNode = this
      c.transform.worldDirty = true
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
