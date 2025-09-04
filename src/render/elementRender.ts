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
import { ImageFillRender } from 'Latte/render/fill/image'
import type { DisplayObject } from 'Latte/core/elements/displayObject'

import { EditorDocument } from 'Latte/core/elements/document'
import Rect from 'Latte/core/elements/rect'
import Ellipse from 'Latte/core/elements/ellipse'
import { Page } from 'Latte/core/elements/page'
import Frame from 'Latte/core/elements/frame'
import { ViewPart } from 'Latte/core/viewParts/base/viewPart'
import type { Camera } from 'Latte/core/services/camera/cameraService'
import type { ViewModel } from 'Latte/core/viweModel/viewModel'
import { Matrix } from 'Latte/core/utils/matrix'

const mergePaints = (paints: Paint[]): Paint[] => {
  const result: Paint[] = []
  for (let i = paints.length - 1; i >= 0; i--) {
    const curPaint = paints[i]
    if (!curPaint.visible) {
      continue
    }
    result.unshift(curPaint)
    if (curPaint.opacity === 1) {
      break
    }
  }
  return result
}

registerEditorShapeRender(EditorElementTypeKind.ELLIPSE, EllipseShapeRender)
registerEditorShapeRender(EditorElementTypeKind.RECTANGLE, RectShapeRender)
registerEditorFillRender(FillType.SOLID, SolidColorFillRender)

registerEditorFillRender(FillType.IMAGE, ImageFillRender)

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

enum RenderType {
  fastRender,
  renderWithTexture,
}

class ElementRender extends ViewPart {
  private _tempMatrix: IMatrixLike = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: 0,
    ty: 0,
  }
  constructor(
    viewModel: ViewModel,
    private readonly _getVisibleElementRenderObjects: () => DisplayObject[]
  ) {
    super(viewModel)
  }

  public override onElementChange(): boolean {
    return true
  }

  private _createClipArea(
    ctx: CanvasRenderingContext2D,
    displayObject: DisplayObject
  ) {
    const shapeRender = getEditorShapeRender(displayObject.type)
    ctx.beginPath()
    shapeRender?.(displayObject, ctx)
    ctx.closePath()
    ctx.clip()
  }

  private _applyCommonAttrToCtx(ctx: CanvasRenderingContext2D, paint: Paint) {
    ctx.globalAlpha = paint.opacity
  }

  private _renderDisplayObject(
    ctx: CanvasRenderingContext2D,
    vpMatrix: IMatrixLike,
    displayObject: DisplayObject
  ) {
    ctx.save()
    this._applyTransform(ctx, vpMatrix, displayObject)
    this._createClipArea(ctx, displayObject)
    const fills = mergePaints(displayObject.getFills())
    if (fills.length === 0) {
      return
    }
    fills.forEach(item => {
      const fillRender = getEditorFillRender(item.type)
      this._applyCommonAttrToCtx(ctx, item)
      fillRender(item, ctx, {
        contextSize: {
          width: displayObject.width,
          height: displayObject.height,
        },
      })
    })
    ctx.restore()
  }

  public override onFocusPageChange(): boolean {
    return true
  }

  private _applyTransform(
    ctx: CanvasRenderingContext2D,
    contextMatrix: IMatrixLike,
    displayObject: DisplayObject
  ) {
    const { transform } = displayObject
    Matrix.multiply(this._tempMatrix, contextMatrix, transform)
    const { a, b, c, d, tx, ty } = this._tempMatrix
    ctx.setTransform(a, b, c, d, tx, ty)
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera) {
    const renderObjects = this._getVisibleElementRenderObjects()
    if (renderObjects.length === 0) {
      return
    }
    const vpMatrix = camera.getViewPortMatrix()
    renderObjects.forEach(item => {
      this._renderDisplayObject(ctx, vpMatrix, item)
    })
  }
}

export default ElementRender
