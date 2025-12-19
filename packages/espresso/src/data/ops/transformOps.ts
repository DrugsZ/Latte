import { mat2d } from 'gl-matrix'
import { MAT_A, MAT_D, MAT_SIZE, MAT_TX, MAT_TY } from '../config'
import type { SceneGraph } from '../sceneGraph'

const TEMP_MATRIX = mat2d.create()

export const TransformOps = {
  getX: (graph: SceneGraph, index: number) => {
    return graph.matrix[index * MAT_SIZE + MAT_TX]
  },

  setX: (graph: SceneGraph, index: number, x: number) => {
    graph.matrix[index * MAT_SIZE + MAT_TX] = x
  },

  getY: (graph: SceneGraph, index: number) => {
    return graph.matrix[index * MAT_SIZE + MAT_TY]
  },

  setY: (graph: SceneGraph, index: number, y: number) => {
    graph.matrix[index * MAT_SIZE + MAT_TY] = y
  },

  getWidth: (graph: SceneGraph, index: number) => {
    return graph.size[index * 2]
  },

  setWidth: (graph: SceneGraph, index: number, width: number) => {
    graph.size[index * 2] = width
  },

  getHeight: (graph: SceneGraph, index: number) => {
    return graph.size[index * 2 + 1]
  },

  setHeight: (graph: SceneGraph, index: number, height: number) => {
    graph.size[index * 2 + 1] = height
  },

  getMatrix: (
    graph: SceneGraph,
    index: number,
    out: mat2d = TEMP_MATRIX
  ): mat2d => {
    const ptr = index * MAT_SIZE
    out[0] = graph.matrix[ptr + 0]
    out[1] = graph.matrix[ptr + 1]
    out[2] = graph.matrix[ptr + 2]
    out[3] = graph.matrix[ptr + 3]
    out[4] = graph.matrix[ptr + 4]
    out[5] = graph.matrix[ptr + 5]
    return out
  },

  setMatrix: (graph: SceneGraph, index: number, matrix: mat2d) => {
    const ptr = index * MAT_SIZE
    graph.matrix[ptr + 0] = matrix[0]
    graph.matrix[ptr + 1] = matrix[1]
    graph.matrix[ptr + 2] = matrix[2]
    graph.matrix[ptr + 3] = matrix[3]
    graph.matrix[ptr + 4] = matrix[4]
    graph.matrix[ptr + 5] = matrix[5]
  },

  identityMatrix(graph: SceneGraph, index: number) {
    const ptr = index * MAT_SIZE
    graph.matrix.fill(0, ptr, ptr + 6)
    graph.matrix[ptr + MAT_A] = 1
    graph.matrix[ptr + MAT_D] = 1
  },

  getTransform: (graph: SceneGraph, index: number): Float32Array => {
    const ptr = index * MAT_SIZE
    return graph.matrix.subarray(ptr, ptr + 6)
  },

  setTransform: (graph: SceneGraph, index: number, transform: number[]) => {
    const ptr = index * MAT_SIZE
    for (let i = 0; i < 6; i++) {
      graph.matrix[ptr + i] = transform[i]
    }
  },
}
