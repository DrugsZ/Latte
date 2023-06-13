import { DisplayObject } from 'Cditor/core/DisplayObject'
import { Container } from 'Cditor/core/Container'
import EditorDocument from 'Cditor/core/document'
import Rect from 'Cditor/core/rect'
import Page from 'Cditor/core/page'
import Frame from 'Cditor/core/frame'

const enum EditorElementTypeKind {
  RECTANGLE = 'RECTANGLE',
  FRAME = 'FRAME',
  PAGE = 'CANVAS',
  DOCUMENT = 'DOCUMENT',
}

export const createElement = (element: BaseNodeSchema) => {
  const { type } = element
  let Ctr: any = null
  switch (type) {
    case EditorElementTypeKind.RECTANGLE:
      Ctr = Rect
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

  constructor(elements: BaseNodeSchema[]) {
    this._initElements(elements)
  }

  private _initElements(elements: BaseNodeSchema[]) {
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
      ;(parentNode as Container).addChild(...value)
    })
  }

  public getPages(): Page[] {
    return this._root.getChildren() as Page[]
  }
}

export default RenderContext
