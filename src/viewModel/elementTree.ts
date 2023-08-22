import Rect from 'Latte/elements/rect'
import Ellipse from 'Latte/elements/ellipse'
import { Page } from 'Latte/core/page'
import Frame from 'Latte/core/frame'
import { EditorDocument } from 'Latte/elements/document'
import { EditorElementTypeKind } from 'Latte/constants/schema'

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
  private _elements: Map<string, DisplayObject> = new Map()
  public _document: EditorDocument

  constructor(elements: BaseElementSchema[]) {
    this._initElements(elements)
  }

  private _initElements(elements: BaseElementSchema[]) {
    const cachedChildElements: {
      [key: string]: DisplayObject[]
    } = {}
    elements.forEach(elm => {
      const currentNode = createElement(elm)
      this._elements.set(currentNode.id, currentNode)
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
      const parentNode = this._elements.get(key)
      if (!parentNode) {
        return
      }
      ;(parentNode as Container).appendChild(...value)
    })
  }

  public getElementById(id: string) {
    return this._elements.get(id)
  }

  get document() {
    return this._document
  }
}
