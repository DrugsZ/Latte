import type { DisplayObject } from 'Cditor/core/DisplayObject'
import { FillType } from 'Cditor/core/DisplayObject'
import Rect from 'Cditor/elements/Rect'
import Ellipse from 'Cditor/elements/Ellipse'

export interface IEditorFillRenderContributionDescription {
  readonly id: FillType
  readonly render: (fill: SolidColorPaint) => void
}

export type ShapeRender = (
  renderObject: DisplayObject | Rect | Ellipse,
  ctx: CanvasRenderingContext2D
) => void

export type FillRender = (
  fill: SolidColorPaint,
  ctx: CanvasRenderingContext2D
) => void

export interface EditorShapeRender {
  render: ShapeRender
}

export interface EditorFillRender {
  render: FillRender
}

export interface EditorShapeRenderCtor {
  new (): EditorShapeRender
}

export interface EditorFillRenderCtor {
  new (): EditorFillRender
}

export class EditorRenderContributionRegistry {
  public static readonly INSTANCE = new EditorRenderContributionRegistry()

  private readonly _editorFillRender: {
    [fillType in FillType]: EditorFillRenderCtor
  }

  private readonly _editorFillRenderInstanceCache: {
    [fillType in FillType]: EditorFillRender
  }

  private readonly _editorShapeRender: {
    [shapeType in EditorElementTypeKind]: EditorShapeRenderCtor
  }

  private readonly _editorShapeRenderInstanceCache: {
    [shapeType in EditorElementTypeKind]: EditorShapeRender
  }
  // private readonly editorStrokeRender: {
  //   [fillType: FillType]: (fill: SolidColorFill) => void
  // }

  constructor() {
    this._editorShapeRender = Object.create(null)
    this._editorShapeRenderInstanceCache = Object.create(null)
    this._editorFillRender = Object.create(null)
    this._editorFillRenderInstanceCache = Object.create(null)
  }

  public registerEditorShapeRender(
    id: EditorElementTypeKind,
    renderCtr: EditorShapeRenderCtor
  ) {
    this._editorShapeRender[id] = renderCtr
  }

  public getEditorShapeRender(id: EditorElementTypeKind) {
    if (!this._editorShapeRenderInstanceCache[id]) {
      const Ctr = this._editorShapeRender[id]
      if (Ctr) {
        this._editorShapeRenderInstanceCache[id] = new Ctr()
      }
    }
    return (this._editorShapeRenderInstanceCache[id] || {}).render
  }

  public registerEditorFillRender(
    id: FillType,
    renderCtr: EditorFillRenderCtor
  ) {
    this._editorFillRender[id] = renderCtr
  }

  public getEditorFillRender(id: FillType) {
    if (!this._editorFillRenderInstanceCache[id]) {
      const Ctr = this._editorFillRender[id]
      if (Ctr) {
        this._editorFillRenderInstanceCache[id] = new Ctr()
      }
    }
    return (this._editorFillRenderInstanceCache[id] || {}).render
  }
}

export function registerEditorShapeRender(
  id: EditorElementTypeKind,
  renderCtr: EditorShapeRenderCtor
) {
  EditorRenderContributionRegistry.INSTANCE.registerEditorShapeRender(
    id,
    renderCtr
  )
}

export function getEditorShapeRender(id: EditorElementTypeKind) {
  return EditorRenderContributionRegistry.INSTANCE.getEditorShapeRender(id)
}

export function registerEditorFillRender(
  id: FillType,
  renderCtr: EditorFillRenderCtor
) {
  EditorRenderContributionRegistry.INSTANCE.registerEditorFillRender(
    id,
    renderCtr
  )
}

export function getEditorFillRender(id: FillType) {
  return EditorRenderContributionRegistry.INSTANCE.getEditorFillRender(id)
}
