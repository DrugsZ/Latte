type ElementType =
  | 'FRAME'
  | 'TEXT'
  | 'GROUP'
  | 'RECTANGLE'
  | 'Vector'
  | 'LINE'
  | 'ARROW'
  | 'ELLIPSE'
  | 'POLYGON'
  | 'STAR'

interface BaseFill {
  type: string
  visible: boolean
  opacity: number
}

interface SolidColorFill extends BaseFill {
  type: 'SOLID'
  color: {
    r: number
    g: number
    b: number
  }
}

type Fill = SolidColorFill

type Transform = [[number, number, number], [number, number, number]]

interface DefaultIDType {
  sessionID: number
  localID: number
}

declare global {
  const EditorElementTypeKind: typeof EditorElementTypeKind
}

interface BaseNodeSchema {
  guid: DefaultIDType
  parentIndex: {
    guid: DefaultIDType
    position: number
  }
  type: EditorElementTypeKind
  name: string
  visible: boolean
  opacity: number
  transform: {
    a: number
    b: number
    c: number
    d: number
    tx: number
    ty: number
  }
  size: {
    x: number
    y: number
  }
  locked: boolean
  fills?: Fill[]
}

interface CditorDocument extends BaseNodeSchema {
  type: EditorElementTypeKind.DOCUMENT
}

interface PAGE extends BaseNodeSchema {
  type: EditorElementTypeKind.PAGE
  backgrounds: Fill[]
}

interface RectangleElement extends BaseNodeSchema {
  type: EditorElementTypeKind.RECTANGLE
  radius: [number, number, number, number]
}

interface FrameElement extends BaseNodeSchema {
  type: EditorElementTypeKind.FRAME
}

interface Window {
  test: any
}

interface CditorFile {
  elements: BaseNodeSchema[]
  sessionID: number
}

interface RectBBox {
  x: number
  y: number
  width: number
  height: number
}
