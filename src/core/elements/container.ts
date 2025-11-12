import { DisplayObject } from 'Latte/core/elements/displayObject'
import { compareASCII } from 'Latte/core/utils/zIndex'

export abstract class Container<
  T extends BaseElementSchema = BaseElementSchema
> extends DisplayObject<T> {
  protected _children: DisplayObject<BaseElementSchema>[] = []

  private static tempMatrix = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: 0,
    ty: 0,
  }

  protected override _updateBounds() {
    this._children.forEach(element => {
      if (!element.visible) {
        return
      }
      const elementBBox = element.getBounds()
      this._bounds.merge(elementBBox)
    })
    const rect = this._bounds.getRectangle()
    Container.tempMatrix.tx = rect.x
    Container.tempMatrix.ty = rect.y
    this._elementData.transform = { ...Container.tempMatrix }
    this._elementData.size = {
      x: rect.width,
      y: rect.height,
    }
  }

  // Override getBounds to calculate bounds based on children, but if has pre bound, use pre & new add child
  getBounds() {
    if (this._children.length === 1) {
      return this._children[0].getBounds()
    }
    return super.getBounds()
  }

  get OBB() {
    if (this._children.length === 1) {
      return this._children[0].OBB
    }
    return super.OBB
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

  protected _appendChild(child: DisplayObject) {
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
    this._boundDirty = true
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

  getFirst() {
    return this._children[0]
  }

  getLast() {
    return this._children[this._children.length - 1]
  }
}
