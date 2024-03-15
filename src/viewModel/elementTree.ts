import Rect from 'Latte/elements/rect'
import Ellipse from 'Latte/elements/ellipse'
import { Page } from 'Latte/core/page'
import Frame from 'Latte/core/frame'
import { EditorDocument } from 'Latte/elements/document'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import { createDefaultElementSchema } from 'Latte/common/schema'

import type { DisplayObject } from 'Latte/core/displayObject'
import type { Container } from 'Latte/core/container'

export const createElement = (element: BaseElementSchema) => {
  const { type } = element
  let Ctr: any = Rect
  switch (type) {
    case EditorElementTypeKind.RECTANGLE:
      Ctr = Rect
      break
    case EditorElementTypeKind.ELLIPSE:
      Ctr = Ellipse
      break
    case EditorElementTypeKind.PAGE:
      Ctr = Page
      break
    case EditorElementTypeKind.FRAME:
      Ctr = Frame
      break
    case EditorElementTypeKind.DOCUMENT:
      Ctr = EditorDocument
      break
    default:
      Ctr = Rect
  }

  return new Ctr(element)
}

export class ElementTree {
  private _document: EditorDocument

  constructor(elements: BaseElementSchema[]) {
    this._initElements(elements)
  }

  private _initElements(elements: BaseElementSchema[]) {
    const cachedChildElements: {
      [key: string]: DisplayObject[]
    } = {}
    const elementMap = new Map()
    elements.forEach(elm => {
      const currentNode = createElement(elm)
      elementMap.set(currentNode.id, currentNode)
      if (currentNode instanceof EditorDocument) {
        this._document = currentNode
        return
      }
      const { parentIndex } = elm
      const { guid: parentGuid } = parentIndex
      const parentGuidKey = JSON.stringify(parentGuid)
      const currentChild =
        cachedChildElements[parentGuidKey] ||
        (cachedChildElements[parentGuidKey] = [])
      currentChild.push(currentNode)
    })
    Object.entries(cachedChildElements).forEach(([key, value]) => {
      const parentNode = elementMap.get(key)
      if (!parentNode) {
        return
      }
      ;(parentNode as Container).appendChild(...value)
    })
    elementMap.clear()
  }

  public getElementById(id: string) {
    if (id === this._document.id) {
      return this._document
    }
    return this._document.getElementById(id)
  }

  get document() {
    return this._document
  }

  public createElementByName(type: EditorElementTypeKind) {
    let data
    if (type === EditorElementTypeKind.RECTANGLE) {
      data = createDefaultElementSchema({ left: 0, top: 0 })
    }
    const newObject = createElement(data)
    return newObject
  }

  public createElementByData<T extends BaseElementSchema>(elementData: T) {
    return createElement(elementData)
  }
}
