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

interface TransformObject {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}
interface BaseFill {
  type:
    | 'SOLID'
    | 'GRADIENT_LINEAR'
    | 'GRADIENT_RADIAL'
    | 'GRADIENT_ANGULAR'
    | 'GRADIENT_DIAMOND'
    | 'IMAGE'
  visible: boolean
  opacity: number
  blendMode:
    | 'NORMAL'
    | 'DARKEN'
    | 'MULTIPLY'
    | 'COLOR_BURN'
    | 'LIGHTEN'
    | 'SCREEN'
    | 'COLOR_DODGE'
    | 'OVERLAY'
    | 'SOFT_LIGHT'
    | 'HARD_LIGHT'
    | 'DIFFERENCE'
    | 'EXCLUSION'
    | 'HUE'
    | 'SATURATION'
    | 'COLOR'
    | 'LUMINOSITY'
}

interface FillColor {
  r: number
  g: number
  b: number
  a: number
}

interface FillColorStop {
  color: FillColor
  position: number
}

interface SolidColorFill extends BaseFill {
  type: 'SOLID'
  color: FillColor
}

interface GradientLinearFill extends BaseFill {
  type: 'GRADIENT_LINEAR'
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

interface GradientRadialFill extends BaseFill {
  type: 'GRADIENT_RADIAL'
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

interface GradientAngularFill extends BaseFill {
  type: 'GRADIENT_ANGULAR'
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

interface GradientDiamondFill extends BaseFill {
  type: 'GRADIENT_DIAMOND'
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

type Fill =
  | SolidColorFill
  | GradientLinearFill
  | GradientRadialFill
  | GradientAngularFill
  | GradientDiamondFill

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
  transform: TransformObject
  size: {
    x: number
    y: number
  }
  locked: boolean
  fillPaints?: Fill[]
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

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

interface IPoint {
  x: number
  y: number
}
