import {
  DashCap,
  type IPaint,
  StrokeAlign,
  type StrokeAlignKey,
  StrokeJoin,
  StrokeStyle,
} from '@latte-js/bean'

import {
  readNodeFills,
  readNodeStrokes,
  writeNodeFills,
  writeNodeStrokes,
} from '../nodeProps'
import type { SceneGraph } from '../sceneGraph'

const CORNER_SIZE = 4

// Corner radius array: [topLeft, topRight, bottomRight, bottomLeft]
export type CornerRadius = [number, number, number, number]

export const StyleOps = {
  getStrokeWeight(graph: SceneGraph, index: number): number {
    return graph.strokeWeight[index]
  },

  setStrokeWeight(graph: SceneGraph, index: number, v: number) {
    graph.strokeWeight[index] = v
  },

  getStrokeAlign(graph: SceneGraph, index: number) {
    return StrokeAlign[graph.strokeAlign[index]] as StrokeAlignKey
  },

  setStrokeAlign(graph: SceneGraph, index: number, v: StrokeAlignKey) {
    graph.strokeAlign[index] = StrokeAlign[v]
  },

  getStrokeJoin(graph: SceneGraph, index: number) {
    return StrokeJoin[graph.strokeJoin[index]] as keyof typeof StrokeJoin
  },

  setStrokeJoin(graph: SceneGraph, index: number, v: keyof typeof StrokeJoin) {
    graph.strokeJoin[index] = StrokeJoin[v]
  },

  getStrokeStyle(graph: SceneGraph, index: number) {
    return StrokeStyle[graph.strokeStyle[index]] as keyof typeof StrokeStyle
  },

  setStrokeStyle(
    graph: SceneGraph,
    index: number,
    v: keyof typeof StrokeStyle
  ) {
    graph.strokeStyle[index] = StrokeStyle[v]
  },

  getDashCap(graph: SceneGraph, index: number) {
    return DashCap[graph.dashCap[index]] as keyof typeof DashCap
  },

  setDashCap(graph: SceneGraph, index: number, v: keyof typeof DashCap) {
    graph.dashCap[index] = DashCap[v]
  },

  getLocked(graph: SceneGraph, index: number): boolean {
    return graph.locked[index] === 1
  },

  setLocked(graph: SceneGraph, index: number, locked: boolean) {
    graph.locked[index] = locked ? 1 : 0
  },

  getVisible(graph: SceneGraph, index: number) {
    return graph.visible[index] === 1
  },

  setVisible(graph: SceneGraph, index: number, visible: boolean) {
    graph.visible[index] = visible ? 1 : 0
  },

  getOpacity(graph: SceneGraph, index: number): number {
    return graph.opacity[index]
  },

  setOpacity(graph: SceneGraph, index: number, opacity: number) {
    graph.opacity[index] = opacity
  },

  // Corner radius operations - [topLeft, topRight, bottomRight, bottomLeft]
  getCornerRadius(graph: SceneGraph, index: number): CornerRadius {
    const base = index * CORNER_SIZE
    return [
      graph.cornerRadius[base],
      graph.cornerRadius[base + 1],
      graph.cornerRadius[base + 2],
      graph.cornerRadius[base + 3],
    ]
  },

  setCornerRadius(graph: SceneGraph, index: number, radius: CornerRadius) {
    const base = index * CORNER_SIZE
    graph.cornerRadius[base] = radius[0]
    graph.cornerRadius[base + 1] = radius[1]
    graph.cornerRadius[base + 2] = radius[2]
    graph.cornerRadius[base + 3] = radius[3]
  },

  getCornerRadiusInto(
    graph: SceneGraph,
    index: number,
    out: Float32Array
  ): Float32Array {
    const base = index * CORNER_SIZE
    out[0] = graph.cornerRadius[base]
    out[1] = graph.cornerRadius[base + 1]
    out[2] = graph.cornerRadius[base + 2]
    out[3] = graph.cornerRadius[base + 3]
    return out
  },

  setCornerRadiusUniform(graph: SceneGraph, index: number, radius: number) {
    const base = index * CORNER_SIZE
    graph.cornerRadius[base] = radius
    graph.cornerRadius[base + 1] = radius
    graph.cornerRadius[base + 2] = radius
    graph.cornerRadius[base + 3] = radius
  },

  // Fill paints operations
  getFills(graph: SceneGraph, index: number): IPaint[] {
    return readNodeFills(graph, index)
  },

  setFills(graph: SceneGraph, index: number, style: IPaint[]) {
    writeNodeFills(graph, index, style)
  },

  // Stroke paints operations
  getStrokes(graph: SceneGraph, index: number): IPaint[] {
    return readNodeStrokes(graph, index)
  },

  setStrokes(graph: SceneGraph, index: number, strokes: IPaint[]) {
    writeNodeStrokes(graph, index, strokes)
  },

  // Legacy alias for setFills
  setStyle(graph: SceneGraph, index: number, style: IPaint[]) {
    writeNodeFills(graph, index, style)
  },
}
