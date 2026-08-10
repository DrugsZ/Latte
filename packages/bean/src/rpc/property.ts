import type { IDType, IPaint } from '../schema'

export type PropertyKey =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'rotation'
  | 'opacity'
  | 'fills'
  | 'strokes'
  | 'strokeWeight'
  | 'cornerRadius'
  | 'visible'
  | 'locked'

export type CornerRadiusValue =
  number | readonly [number, number, number, number]

export interface PropertyValueMap {
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
  readonly rotation?: number
  readonly opacity?: number
  readonly fills?: readonly IPaint[]
  readonly strokes?: readonly IPaint[]
  readonly strokeWeight?: number
  readonly cornerRadius?: CornerRadiusValue
  readonly visible?: boolean
  readonly locked?: boolean
}

export interface IPropertyService {
  setProperties(ids: IDType[], values: PropertyValueMap): Promise<void>
}
