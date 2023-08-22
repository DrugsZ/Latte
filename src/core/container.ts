import { DisplayObject } from 'Latte/core/displayObject'
import { compareASCII } from 'Latte/math/zIndex'

export abstract class Container<
  T extends BaseElementSchema = BaseElementSchema
> extends DisplayObject<T> {
  protected _children: DisplayObject<BaseElementSchema>[] = []

  getBounds() {
    this._children.forEach(element => {
      if (!element.visible) {
        return
      }
      const elementBBox = element.getBounds()
      this._bounds.merge(elementBBox)
    })
    return this._bounds
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
