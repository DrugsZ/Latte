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

declare enum FillType {
  SOLID = 'SOLID',
  GRADIENT_LINEAR = 'GRADIENT_LINEAR',
  GRADIENT_RADIAL = 'GRADIENT_RADIAL',
  GRADIENT_ANGULAR = 'GRADIENT_ANGULAR',
  GRADIENT_DIAMOND = 'GRADIENT_DIAMOND',
  IMAGE = 'IMAGE',
}

declare enum BlendModeType {
  NORMAL = 'NORMAL',
  DARKEN = 'DARKEN',
  MULTIPLY = 'MULTIPLY',
  COLOR_BURN = 'COLOR_BURN',
  LIGHTEN = 'LIGHTEN',
  SCREEN = 'SCREEN',
  COLOR_DODGE = 'COLOR_DODGE',
  OVERLAY = 'OVERLAY',
  SOFT_LIGHT = 'SOFT_LIGHT',
  HARD_LIGHT = 'HARD_LIGHT',
  DIFFERENCE = 'DIFFERENCE',
  EXCLUSION = 'EXCLUSION',
  HUE = 'HUE',
  SATURATION = 'SATURATION',
  COLOR = 'COLOR',
  LUMINOSITY = 'LUMINOSITY',
}

interface BaseFill {
  type: FillType
  visible: boolean
  opacity: number
  blendMode: BlendModeType
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

interface SolidColorPaint extends BaseFill {
  type: FillType.SOLID
  color: FillColor
}

interface GradientLinearPaint extends BaseFill {
  type: FillType.GRADIENT_LINEAR
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

interface GradientRadialPaint extends BaseFill {
  type: FillType.GRADIENT_RADIAL
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

interface GradientAngularPaint extends BaseFill {
  type: FillType.GRADIENT_ANGULAR
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

interface GradientDiamondPaint extends BaseFill {
  type: FillType.GRADIENT_DIAMOND
  stops: [FillColorStop, FillColorStop]
  transform: TransformObject
}

type Paint =
  | SolidColorPaint
  | GradientLinearPaint
  | GradientRadialPaint
  | GradientAngularPaint
  | GradientDiamondPaint

interface DefaultIDType {
  sessionID: number
  localID: number
}

declare enum EditorElementTypeKind {
  RECTANGLE = 'RECTANGLE',
  ELLIPSE = 'ELLIPSE',
  FRAME = 'FRAME',
  PAGE = 'CANVAS',
  DOCUMENT = 'DOCUMENT',
}

interface BaseNodeSchema {
  type: EditorElementTypeKind
  guid: DefaultIDType
  name: string
  visible: boolean
  opacity: number
  transform: TransformObject
}

interface BaseChildNodeSchema extends BaseNodeSchema {
  parentIndex: {
    guid: DefaultIDType
    position: string
  }
}

interface NodeStrokeSchema {
  strokeWeight: number
  strokeAlign: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  strokeJoin: 'MITER' | 'BEVEL' | 'ROUND'
  miterAngle: number
  strokeStyle: 'SOLID' | 'DASH'
  dashCap: 'NONE' | 'SQUARE' | 'ROUND'
  strokePaints?: Paint[]
}

interface BaseElementSchema extends NodeStrokeSchema, BaseChildNodeSchema {
  name: string
  size: {
    x: number
    y: number
  }
  locked: boolean
  fillPaints?: Paint[]
}

interface LatteFile {
  type: 'NODE_CHANGES'
  elements: BaseElementSchema[]
  sessionID: number
  guid: DefaultIDType
}

interface LatteDocument extends BaseNodeSchema {
  type: EditorElementTypeKind.DOCUMENT
}

interface PAGE extends BaseChildNodeSchema {
  type: EditorElementTypeKind.PAGE
  backgrounds: Paint[]
}

interface FrameElement extends BaseElementSchema {
  type: EditorElementTypeKind.FRAME
}

interface BaseNodeCornerSchema extends BaseElementSchema {
  cornerRadius: number
  cornerSmoothing: number
}

interface RectangleElement extends BaseNodeCornerSchema {
  type: EditorElementTypeKind.RECTANGLE
  cornerRadius: number | 'MIXED'
  topLeftRadius: number
  topRightRadius: number
  bottomLeftRadius: number
  bottomRightRadius: number
  strokeTopWeight: number
  strokeBottomWeight: number
  strokeLeftWeight: number
  strokeRightWeight: number
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
