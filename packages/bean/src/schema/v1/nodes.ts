import type { Matrix } from '../../math'
import type { NodeType } from './types'
import type { IStrokeSchema } from './stroke'
import type { IPaint } from './fill'

export type IDType = `${number | string}:${number | string}`

export interface IParentIndex {
  guid: IDType
  position: string
}

export interface IBaseNodeSchema {
  type: NodeType
  guid: IDType
  name: string
  visible: boolean
  opacity: number
  transform: Matrix
}

export interface IBaseChildNodeSchema extends IBaseNodeSchema {
  parentIndex: IParentIndex
}

export interface IBaseSizeAbleNodeSchema
  extends IStrokeSchema, IBaseChildNodeSchema {
  name: string
  size: {
    x: number
    y: number
  }
  locked: boolean
}

export interface IBaseCanFillNodeSchema extends IBaseSizeAbleNodeSchema {
  fillPaints?: IPaint[]
}

export interface ILatteDocumentNode extends IBaseNodeSchema {
  type: NodeType.DOCUMENT
}

export interface ICanvasNode extends IBaseChildNodeSchema {
  type: NodeType.CANVAS
  backgrounds: IPaint[]
}

export interface IFrameNode extends IBaseSizeAbleNodeSchema {
  type: NodeType.FRAME
}
export interface IGroupNode extends IBaseSizeAbleNodeSchema {
  type: NodeType.GROUP
}

export type ContainerNode = ICanvasNode | IFrameNode | IGroupNode
export interface IBaseNodeCornerSchema extends IBaseSizeAbleNodeSchema {
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
  type: NodeType.RECTANGLE
  topLeftRadius: number
  topRightRadius: number
  bottomLeftRadius: number
  bottomRightRadius: number
  strokeTopWeight: number
  strokeBottomWeight: number
  strokeLeftWeight: number
  strokeRightWeight: number
}

export type ILatteNode =
  | ILatteDocumentNode
  | ICanvasNode
  | IFrameNode
  | IGroupNode
  | IRectangleNode

export interface ILatteFile {
  elements: ILatteNode[]
}
