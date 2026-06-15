import type { IPaint } from '@latte-js/bean'

import { NULL_INDEX } from './config'

import type { SceneGraph } from './sceneGraph'

export interface INodeGeometryPayload {
  points?: number[]
}

const readBlob = <T>(
  graph: SceneGraph,
  ptr: number,
  isRawString = false
): T | null => {
  if (ptr === NULL_INDEX || ptr <= 0) {
    return null
  }
  return graph.blobs.read<T>(ptr, isRawString)
}

export const readNodeName = (
  graph: SceneGraph,
  index: number,
  fallback = 'Layer'
) => {
  return readBlob<string>(graph, graph.namePtr[index], true) ?? fallback
}

export const writeNodeName = (
  graph: SceneGraph,
  index: number,
  name: string
) => {
  const ptr = graph.blobs.replace(graph.namePtr[index], name)
  graph.namePtr[index] = ptr
  return ptr
}

export const readNodeFills = (graph: SceneGraph, index: number): IPaint[] => {
  return readBlob<IPaint[]>(graph, graph.fillPtr[index]) ?? []
}

export const writeNodeFills = (
  graph: SceneGraph,
  index: number,
  fills: IPaint[]
) => {
  const ptr = graph.blobs.replace(graph.fillPtr[index], fills)
  graph.fillPtr[index] = ptr
  return ptr
}

export const readNodeStrokes = (graph: SceneGraph, index: number): IPaint[] => {
  return readBlob<IPaint[]>(graph, graph.strokePtr[index]) ?? []
}

export const writeNodeStrokes = (
  graph: SceneGraph,
  index: number,
  strokes: IPaint[]
) => {
  const ptr = graph.blobs.replace(graph.strokePtr[index], strokes)
  graph.strokePtr[index] = ptr
  return ptr
}

export const readNodeGeometry = <T extends object = INodeGeometryPayload>(
  graph: SceneGraph,
  index: number
): T | null => {
  return readBlob<T>(graph, graph.geometryPtr[index])
}

export const writeNodeGeometry = <T extends object>(
  graph: SceneGraph,
  index: number,
  geometry: T
) => {
  const ptr = graph.blobs.replace(graph.geometryPtr[index], geometry)
  graph.geometryPtr[index] = ptr
  return ptr
}
