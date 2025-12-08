import type { IPaint } from './fill'

export interface IStrokeSchema {
  strokeWeight: number
  strokeAlign: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  strokeJoin: 'MITER' | 'BEVEL' | 'ROUND'
  miterAngle: number
  strokeStyle: 'SOLID' | 'DASH'
  dashCap: 'NONE' | 'SQUARE' | 'ROUND'
  strokePaints?: IPaint[]
}
