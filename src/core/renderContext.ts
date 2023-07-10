import type { DisplayObject } from 'Latte/core/DisplayObject'
import { EditorElementTypeKind } from 'Latte/constants/schema'
import type { Container } from 'Latte/core/Container'
import { EditorDocument } from 'Latte/elements/document'
import Rect from 'Latte/elements/Rect'
import Ellipse from 'Latte/elements/Ellipse'
import Page from 'Latte/core/page'
import Frame from 'Latte/core/frame'

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

class RenderContext {
  private _elements: Map<string, DisplayObject> = new Map()
  private _root: EditorDocument

  constructor(elements: BaseElementSchema[]) {
    this._initElements(elements)
  }

  private _initElements(elements: BaseElementSchema[]) {
    const cachedChildElements: {
      [key: string]: DisplayObject[]
    } = {}
    elements.forEach(elm => {
      const currentNode = createElement(elm)
      this._elements.set(JSON.stringify(elm.guid), currentNode)
      if (currentNode instanceof EditorDocument) {
        this._root = currentNode
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

  public getPages(): Page[] {
    return this._root.getChildren() as Page[]
  }

  public getRoot(): EditorDocument {
    return this._root
  }
}

export default RenderContext
