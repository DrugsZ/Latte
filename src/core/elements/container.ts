import { DisplayObject } from 'Latte/core/elements/displayObject'
import { compareASCII } from 'Latte/core/utils/zIndex'

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

  public override getElementById(id: string) {
    const superResult = super.getElementById(id)
    if (superResult) {
      return superResult
    }
    const children = this._children
    let target: DisplayObject | undefined
    children.some(child => {
      target = child.getElementById(id)
      return target
    })
    return target
  }

  public getElementByTagName(tagName: string) {
    const result: DisplayObject[] = []
    this._children.forEach(child => {
      if (child.type === tagName) {
        result.push(child)
      }
      if (child instanceof Container) {
        result.push(...child.getElementByTagName(tagName))
      }
    })
    return result
  }

  private _appendChild(child: DisplayObject) {
    const childLength = this._children.length
    let index = 0
    let isAddEnd = false
    while (index < childLength && !isAddEnd) {
      const compareChild = this._children[index]
      const compareZIndex = compareChild.zIndex
      const currentZIndex = child.zIndex
      if (compareASCII(compareZIndex, currentZIndex)) {
        isAddEnd = true
      } else {
        index++
      }
    }
    this._children.splice(index, 0, child)
    child.parentNode?.removeChild(child)
    child.parentNode = this
  }

  appendChild(...child: DisplayObject[]) {
    child.forEach(item => {
      this._appendChild(item)
    }, this)
  }

  removeChild(removeChild: DisplayObject) {
    let hasFindRemove: undefined | DisplayObject
    this._children = this._children?.filter(child => {
      const willReserve = !Object.is(child, removeChild)
      if (!willReserve) {
        child.parentNode = null
        hasFindRemove = child
        return false
      }
      return willReserve
    })
    return hasFindRemove
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

  getFirst() {
    return this._children[0]
  }

  getLast() {
    return this._children[this._children.length - 1]
  }
}

export default DisplayObject
