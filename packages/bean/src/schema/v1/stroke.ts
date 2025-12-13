import type { IPaint } from './fill'

export enum StrokeAlign {
  INSIDE,
  CENTER,
  OUTSIDE,
}

export type StrokeAlignKey = keyof typeof StrokeAlign

export enum StrokeJoin {
  MITER,
  BEVEL,
  ROUND,
}

export enum StrokeStyle {
  SOLID,
  DASH,
}

export enum DashCap {
  NONE,
  SQUARE,
  ROUND,
}

export interface IStrokeSchema {
  strokeWeight: number
  strokeAlign: StrokeAlign
  strokeJoin: StrokeJoin
  miterAngle: number
  strokeStyle: StrokeStyle
  dashCap: DashCap
  strokePaints?: IPaint[]
}
