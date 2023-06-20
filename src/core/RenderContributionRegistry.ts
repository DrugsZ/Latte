import { IBaseRenderObject } from 'Cditor/core/DisplayObject'

enum FillType {
  SOLID = 'SOLID',
  GRADIENT_LINEAR = 'GRADIENT_LINEAR',
  GRADIENT_RADIAL = 'GRADIENT_RADIAL',
  GRADIENT_ANGULAR = 'GRADIENT_ANGULAR',
  GRADIENT_DIAMOND = 'GRADIENT_DIAMOND',
  IMAGE = 'IMAGE',
}

export interface IEditorFillRenderContributionDescription {
  readonly id: FillType
  readonly render: (fill: SolidColorPaint) => void
}

export type ShapeRender = (
  renderObject: IBaseRenderObject,
  ctx: CanvasRenderingContext2D
) => void

export interface EditorShapeRender {
  render: ShapeRender
}

export interface EditorShapeRenderCtor {
  new (): EditorShapeRender
}

export class EditorRenderContributionRegistry {
  public static readonly INSTANCE = new EditorRenderContributionRegistry()

  private readonly editorFillRender: {
    [fillType in FillType]: (fill: SolidColorPaint) => void
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
