import {
  IBaseRenderObject,
  EditorElementTypeKind,
} from 'Cditor/core/DisplayObject'

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
  readonly render: (fill: SolidColorFill) => void
}

export type ShapeRender = (
  renderObject: IBaseRenderObject,
  ctx: CanvasRenderingContext2D
) => void

export class EditorRenderContributionRegistry {
  public static readonly INSTANCE = new EditorRenderContributionRegistry()

  private readonly editorFillRender: {
    [fillType in FillType]: (fill: SolidColorFill) => void
  }
  private readonly _editorShapeRender: {
    [shapeType in EditorElementTypeKind]: ShapeRender
  }
  // private readonly editorStrokeRender: {
  //   [fillType: FillType]: (fill: SolidColorFill) => void
  // }

  constructor() {
    this._editorShapeRender = Object.create(null)
  }

  public registerEditorShapeRender(
    id: EditorElementTypeKind,
    render: ShapeRender
  ) {
    this._editorShapeRender[id] = render
  }

  public getEditorShapeRender(id: EditorElementTypeKind): ShapeRender | null {
    return this._editorShapeRender[id] || null
  }
}

export function registerEditorShapeRender(
  id: EditorElementTypeKind,
  render: ShapeRender
) {
  EditorRenderContributionRegistry.INSTANCE.registerEditorShapeRender(
    id,
    render
  )
}

export function getEditorShapeRender(id: EditorElementTypeKind) {
  return EditorRenderContributionRegistry.INSTANCE.getEditorShapeRender(id)
}
