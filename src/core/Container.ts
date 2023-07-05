import { DisplayObject } from 'Latte/core/DisplayObject'
import { compareASCII } from 'Latte/math/zIndex'

export abstract class Container<
  T extends BaseElementSchema = BaseElementSchema
> extends DisplayObject<T> {
  protected _children: DisplayObject<BaseElementSchema>[] = []

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

  private _appendChild(child: DisplayObject) {
    const childLength = this._children.length
    let index = 0
    let isAddEnd = false
    while (index < childLength && !isAddEnd) {
      const compareChild = this._children[index]
      const compareZIndex = compareChild.getZIndex()
      const currentZIndex = child.getZIndex()
      if (compareASCII(compareZIndex, currentZIndex)) {
        isAddEnd = true
      } else {
        index++
      }
    }
    this._children.splice(index, 0, child)
    child.parentNode?.removeChild(child)
    child.parentNode = this
    child.transform.worldDirty = true
  }

  appendChild(...child: DisplayObject[]) {
    child.forEach(item => {
      this._appendChild(item)
    }, this)
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
