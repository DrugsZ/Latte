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

export type StrokeJoinKey = keyof typeof StrokeJoin

export enum StrokeStyle {
  SOLID,
  DASH,
}

export type StrokeStyleKey = keyof typeof StrokeStyle

export enum DashCap {
  NONE,
  SQUARE,
  ROUND,
}

export type DashCapKey = keyof typeof DashCap

export interface IStrokeSchema {
  strokeWeight: number
  strokeAlign: StrokeAlignKey
  strokeJoin: StrokeJoinKey
  // miterAngle: number
  strokeStyle: StrokeStyleKey
  dashCap: DashCapKey
  strokePaints?: IPaint[]
}
