import {
  StrokeAlign,
  type StrokeAlignKey,
  StrokeJoin,
  StrokeStyle,
  DashCap,
  type IPaint,
} from '@latte-js/bean'
import type { SceneGraph } from '../sceneGraph'

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
    return DashCap[graph.strokeStyle[index]] as keyof typeof DashCap
  },

  setDashCap(graph: SceneGraph, index: number, v: keyof typeof DashCap) {
    graph.strokeStyle[index] = DashCap[v]
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

  getFills(graph: SceneGraph, index: number): IPaint[] {
    const ptr = graph.blobIndexToPtr.get(index)
    if (!ptr) {
      return []
    }
    return graph.blobs.read(ptr) || []
  },

  setStyle(graph: SceneGraph, index: number, style: IPaint[]) {
    const ptr = graph.blobs.write(style)
    graph.blobIndexToPtr.set(index, ptr)
  },
}
