import type { FillType } from 'Latte/constants/schema'
import type Rect from 'Latte/core/elements/rect'
import type Ellipse from 'Latte/core/elements/ellipse'

export interface EditorTypeRenderCtor<T> {
  new (): T
}

export interface EditorTypeRender<T = (...arg) => any> {
  render: T
}

export class EditorRenderTypeContributionRegistry<
  K extends FillType | EditorElementTypeKind,
  C extends EditorTypeRender
> {
  public static readonly INSTANCE = new EditorRenderTypeContributionRegistry()

  private readonly _editorTypeRender: {
    [key in K]: EditorTypeRenderCtor<C>
  }

  private readonly _editorTypeRenderInstanceCache: {
    [key in K]: C
  }

  constructor() {
    this._editorTypeRender = Object.create(null)
    this._editorTypeRenderInstanceCache = Object.create(null)
  }

  public registerEditorTypeRender(id: K, renderCtr: EditorTypeRenderCtor<C>) {
    this._editorTypeRender[id] = renderCtr
  }

  public getEditorTypeRender(id: K) {
    if (!this._editorTypeRenderInstanceCache[id]) {
      const Ctr = this._editorTypeRender[id]
      if (Ctr) {
        this._editorTypeRenderInstanceCache[id] = new Ctr()
      }
    }
    return (this._editorTypeRenderInstanceCache[id] || {}).render
  }
}
export interface FillRenderOptions {
  contextSize: {
    width: number
    height: number
  }
}

export interface IEditorFillRenderContributionDescription<
  T extends Paint = any
> {
  readonly render: (
    fill: T,
    ctx: CanvasRenderingContext2D,
    options?: FillRenderOptions
  ) => void
}

class EditorRenderFillContributionRegistry extends EditorRenderTypeContributionRegistry<
  FillType,
  IEditorFillRenderContributionDescription
> {}

export function registerEditorFillRender(
  id: FillType,
  renderCtr: EditorTypeRenderCtor<IEditorFillRenderContributionDescription>
) {
  EditorRenderFillContributionRegistry.INSTANCE.registerEditorTypeRender(
    id,
    renderCtr
  )
}

export function getEditorFillRender(id: FillType) {
  return EditorRenderFillContributionRegistry.INSTANCE.getEditorTypeRender(id)
}

interface ShapeRenderTypeMaps {
  [EditorElementTypeKind.RECTANGLE]: Rect
  [EditorElementTypeKind.ELLIPSE]: Ellipse
  [EditorElementTypeKind.DOCUMENT]: null
  [EditorElementTypeKind.FRAME]: null
  [EditorElementTypeKind.PAGE]: null
}
export interface IEditorShapeRenderContributionDescription<
  T extends EditorElementTypeKind = any
> {
  readonly id: EditorElementTypeKind
  readonly render: (
    renderObject: ShapeRenderTypeMaps[T],
    ctx: CanvasRenderingContext2D
  ) => void
}

class EditorRenderShapeContributionRegistry extends EditorRenderTypeContributionRegistry<
  EditorElementTypeKind,
  IEditorShapeRenderContributionDescription
> {}

export function registerEditorShapeRender<T extends EditorElementTypeKind>(
  id: T,
  renderCtr: EditorTypeRenderCtor<IEditorShapeRenderContributionDescription<T>>
) {
  EditorRenderShapeContributionRegistry.INSTANCE.registerEditorTypeRender(
    id,
    renderCtr
  )
}

export function getEditorShapeRender(id: EditorElementTypeKind) {
  return EditorRenderShapeContributionRegistry.INSTANCE.getEditorTypeRender(id)
}
