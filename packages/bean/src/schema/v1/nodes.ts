import { Matrix } from '../../math'
import { NodeType } from './types'
import { IStrokeSchema } from './stroke'
import { IPaint } from './fill'

export type IDType = `${number | string}:${number | string}`

export interface IBaseNodeSchema {
  type: NodeType
  guid: IDType
  name: string
  visible: boolean
  opacity: number
  transform: Matrix
}

export interface IBaseChildNodeSchema extends IBaseNodeSchema {
  parentIndex: {
    guid: IDType
    position: string
  }
}

export interface IBaseElementSchema
  extends IStrokeSchema,
    IBaseChildNodeSchema {
  name: string
  size: {
    x: number
    y: number
  }
  locked: boolean
  fillPaints?: IPaint[]
}

export interface ILatteDocument extends IBaseNodeSchema {
  type: NodeType.DOCUMENT
}

export interface IPage extends IBaseChildNodeSchema {
  type: NodeType.PAGE
  backgrounds: IPaint[]
}

export interface IFrameElement extends IBaseElementSchema {
  type: NodeType.FRAME
}
export interface IGroupElement extends IBaseElementSchema {
  type: NodeType.GROUP
}

export type ContainerElement = IPage | IFrameElement | IGroupElement

export interface IBaseNodeCornerSchema extends IBaseElementSchema {
  cornerRadius: number
  cornerSmoothing: number
}

export interface IRectangleElement extends IBaseNodeCornerSchema {
  type: NodeType.RECTANGLE
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

export interface IRectangle {
  x: number
  y: number
  width: number
  height: number
}

export type OBB = Rectangle & {
  transform: IMatrixLike
}

export interface IPoint {
  x: number
  y: number
}
