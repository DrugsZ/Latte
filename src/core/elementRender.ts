import {
  getEditorShapeRender,
  getEditorFillRender,
  registerEditorShapeRender,
  registerEditorFillRender,
} from 'Latte/render/renderContributionRegistry'
import { EditorElementTypeKind, FillType } from 'Latte/constants/schema'
import { RectShapeRender } from 'Latte/render/shape/rect'
import { EllipseShapeRender } from 'Latte/render/shape/ellipse'
import { SolidColorFillRender } from 'Latte/render/fill/solid'
import type { DisplayObject } from 'Latte/core/displayObject'

import { EditorDocument } from 'Latte/elements/document'
import Rect from 'Latte/elements/rect'
import Ellipse from 'Latte/elements/ellipse'
import Page from 'Latte/core/page'
import Frame from 'Latte/core/frame'
import { ViewPart } from 'Latte/view/viewPart'
import type { Camera } from 'Latte/core/cameraService'
import type { ViewFocusPageChangeEvent } from 'Latte/view/viewEvents'
import type { ViewModel } from 'Latte/core/viewModel'

registerEditorShapeRender(EditorElementTypeKind.ELLIPSE, EllipseShapeRender)
registerEditorShapeRender(EditorElementTypeKind.RECTANGLE, RectShapeRender)
registerEditorFillRender(FillType.SOLID, SolidColorFillRender)

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

class ElementRender extends ViewPart {
  private _elements: Map<string, DisplayObject> = new Map()
  private _root: EditorDocument
  private _focusPage?: Page

  constructor(
    viewModel: ViewModel,
    private readonly _getVisibleElementRenderObjects: () => DisplayObject[]
  ) {
    super(viewModel)
    // this._initElements(elements)
  }

  // private _initElements(elements: BaseElementSchema[]) {
  //   const cachedChildElements: {
  //     [key: string]: DisplayObject[]
  //   } = {}
  //   elements.forEach(elm => {
  //     const currentNode = createElement(elm)
  //     this._elements.set(JSON.stringify(elm.guid), currentNode)
  //     if (currentNode instanceof EditorDocument) {
  //       this._root = currentNode
  //       return
  //     }
  //     const { parentIndex } = elm
  //     const { guid: parentGuid } = parentIndex
  //     const parentGuidKey = JSON.stringify(parentGuid)
  //     const currentChild =
  //       cachedChildElements[parentGuidKey] ||
  //       (cachedChildElements[parentGuidKey] = [])
  //     currentChild.push(currentNode)
  //   })
  //   Object.entries(cachedChildElements).forEach(([key, value]) => {
  //     const parentNode = this._elements.get(key)
  //     if (!parentNode) {
  //       return
  //     }
  //     ;(parentNode as Container).appendChild(...value)
  //   })
  //   this.setShouldRender()
  // }

  // public getPages(): Page[] {
  //   return this._root.getChildren() as Page[]
  // }

  // public getRoot(): EditorDocument {
  //   return this._root
  // }

  public override onFocusPageChange(): boolean {
    // const focusPage = this.getPages().find(
    //   item => item.id === event.newFocusPageId
    // )
    // this._focusPage = focusPage
    return true
  }

  // get visibleElementRenderObjects() {
  //   return this._focusPage?.getVisibleElementRenderObjects()
  // }

  public render(ctx: CanvasRenderingContext2D, camera: Camera) {
    const renderObjects = this._getVisibleElementRenderObjects()
    if (renderObjects.length === 0) {
      return
    }
    const vpMatrix = camera.getViewPortMatrix()
    renderObjects.forEach(item => {
      ctx.save()
      const fills = item.getFills()
      fills.forEach(i => {
        const fillRender = getEditorFillRender(i.type)
        fillRender(i, ctx)
      })
      ctx.beginPath()
      const shapeRender = getEditorShapeRender(item.type)
      shapeRender?.(item, ctx, vpMatrix)
      ctx.fill()
      ctx.closePath()
      ctx.restore()
    })
  }
}

export default ElementRender
