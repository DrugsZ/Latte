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
  type: NodeType | keyof typeof NodeType
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
  parentIndex: IParentIndex
}

export interface IBaseSizeAbleNodeSchema extends IBaseChildNodeSchema {
  name: string
}

export interface IBaseCanFillNodeSchema extends IBaseSizeAbleNodeSchema {
  fillPaints?: IPaint[]
}

export interface ILatteDocumentNode extends IBaseChildNodeSchema {
  type: NodeType.DOCUMENT | 'DOCUMENT'
}

export interface IPageNode extends IBaseChildNodeSchema {
  type: NodeType.CANVAS | 'CANVAS'
  backgrounds: IPaint[]
}

export interface IFrameNode extends IBaseCanFillNodeSchema {
  type: NodeType.FRAME | 'FRAME'
}
export interface IGroupNode extends IBaseSizeAbleNodeSchema {
  type: NodeType.GROUP | 'GROUP'
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
  type: NodeType.RECTANGLE | 'RECTANGLE'
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
  type: NodeType.ELLIPSE | 'ELLIPSE'
}

export interface ICircleNode extends IBaseCanFillNodeSchema {
  type: NodeType.CIRCLE | 'CIRCLE'
}

export interface ITextNode extends IBaseCanFillNodeSchema {
  type: NodeType.TEXT | 'TEXT'
}

export interface IPathNode extends IBaseCanFillNodeSchema {
  type: NodeType.PATH | 'PATH'
}

export interface ILineNode extends IBaseCanFillNodeSchema {
  type: NodeType.LINE | 'LINE'
}

export interface IPolygonNode extends IBaseCanFillNodeSchema {
  type: NodeType.POLYGON | 'POLYGON'
}

export interface IStarNode extends IBaseCanFillNodeSchema {
  type: NodeType.STAR | 'STAR'
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
