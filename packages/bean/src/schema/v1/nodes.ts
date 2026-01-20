import type { Matrix } from '../../math'
import type { NodeType } from './types'
import type { IStrokeSchema } from './stroke'
import type { IPaint } from './fill'
import type { BlendModeType } from './blend'

export type IDType = `${number | string}:${number | string}`

export interface IParentIndex {
  guid: IDType
  position: string
}

export interface IBaseNodeSchema extends IStrokeSchema {
  type: keyof typeof NodeType
  guid: IDType
  name: string
  visible: boolean
  opacity: number
  transform: Matrix
  strokeWeight: number
  locked: boolean
  size: {
    x: number
    y: number
  }
  blendMode: BlendModeType
}

export interface IBaseChildNodeSchema extends IBaseNodeSchema {
  parentIndex?: IParentIndex
}

export interface IBaseSizeAbleNodeSchema extends IBaseChildNodeSchema {
  name: string
}

export interface IBaseCanFillNodeSchema extends IBaseSizeAbleNodeSchema {
  fillPaints?: IPaint[]
}

export interface ILatteDocumentNode extends IBaseChildNodeSchema {
  type: 'DOCUMENT'
}

export interface IPageNode extends IBaseChildNodeSchema {
  type: 'CANVAS'
  backgrounds: IPaint[]
}

export interface IFrameNode extends IBaseCanFillNodeSchema {
  type: 'FRAME'
}
export interface IGroupNode extends IBaseSizeAbleNodeSchema {
  type: 'GROUP'
}

export type ContainerNode =
  | ILatteDocumentNode
  | IPageNode
  | IFrameNode
  | IGroupNode
export interface IBaseNodeCornerSchema extends IBaseCanFillNodeSchema {
  cornerRadius: number
  cornerSmoothing: number
}

export interface IRectangle {
  x: number
  y: number
  width: number
  height: number
}

export type OBB = IRectangle & {
  transform: Matrix
}

export interface IPoint {
  x: number
  y: number
}

export interface IRectangleNode extends IBaseNodeCornerSchema {
  type: 'RECTANGLE'
  topLeftRadius: number
  topRightRadius: number
  bottomLeftRadius: number
  bottomRightRadius: number
  strokeTopWeight: number
  strokeBottomWeight: number
  strokeLeftWeight: number
  strokeRightWeight: number
}

export interface IEllipseNode extends IBaseCanFillNodeSchema {
  type: 'ELLIPSE'
}

export interface ICircleNode extends IBaseCanFillNodeSchema {
  type: 'CIRCLE'
}

export interface ITextNode extends IBaseCanFillNodeSchema {
  type: 'TEXT'
}

export interface IPathNode extends IBaseCanFillNodeSchema {
  type: 'PATH'
}

export interface ILineNode extends IBaseCanFillNodeSchema {
  type: 'LINE'
}

export interface IPolygonNode extends IBaseCanFillNodeSchema {
  type: 'POLYGON'
}

export interface IStarNode extends IBaseCanFillNodeSchema {
  type: 'STAR'
}

export type ILatteNode =
  | ILatteDocumentNode
  | IPageNode
  | IFrameNode
  | IGroupNode
  | IRectangleNode
  | IEllipseNode
  | ICircleNode
  | ITextNode
  | IPathNode
  | ILineNode
  | IPolygonNode
  | IStarNode

export interface ILatteFile {
  elements: ILatteNode[]
}
