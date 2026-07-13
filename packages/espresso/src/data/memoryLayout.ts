import { MAX_NODES, MAT_SIZE, SIZE_SIZE } from './config'

export const LAYOUT_DEF = [
  { name: 'revision', type: Int32Array, size: 1 },

  { name: 'parent', type: Int32Array, size: MAX_NODES },
  { name: 'firstChild', type: Int32Array, size: MAX_NODES },
  { name: 'nextSibling', type: Int32Array, size: MAX_NODES },
  { name: 'prevSibling', type: Int32Array, size: MAX_NODES },
  { name: 'lastChild', type: Int32Array, size: MAX_NODES },

  { name: 'matrix', type: Float32Array, size: MAX_NODES * MAT_SIZE },
  { name: 'worldMatrix', type: Float32Array, size: MAX_NODES * MAT_SIZE },
  { name: 'aabb', type: Float32Array, size: MAX_NODES * 4 },
  { name: 'size', type: Float32Array, size: MAX_NODES * SIZE_SIZE },

  { name: 'type', type: Uint8Array, size: MAX_NODES },
  { name: 'lifecycle', type: Uint8Array, size: MAX_NODES },
  { name: 'visible', type: Uint8Array, size: MAX_NODES },
  { name: 'locked', type: Uint8Array, size: MAX_NODES },
  { name: 'opacity', type: Float32Array, size: MAX_NODES },
  { name: 'textPtr', type: Int32Array, size: MAX_NODES },
  { name: 'namePtr', type: Int32Array, size: MAX_NODES },
  { name: 'geometryPtr', type: Int32Array, size: MAX_NODES },
  { name: 'fillPtr', type: Int32Array, size: MAX_NODES },
  { name: 'strokePtr', type: Int32Array, size: MAX_NODES },

  { name: 'strokeWeight', type: Int32Array, size: MAX_NODES },
  { name: 'strokeAlign', type: Uint8Array, size: MAX_NODES },
  { name: 'strokeJoin', type: Uint8Array, size: MAX_NODES },
  { name: 'strokeStyle', type: Uint8Array, size: MAX_NODES },
  { name: 'dashCap', type: Uint8Array, size: MAX_NODES },

  // Corner radius: [topLeft, topRight, bottomRight, bottomLeft] per node
  { name: 'cornerRadius', type: Float32Array, size: MAX_NODES * 4 },
] as const

export const TOTAL_MEMORY_BYTES = LAYOUT_DEF.reduce((acc, item) => {
  const bytesPerElement = item.type.BYTES_PER_ELEMENT
  return acc + item.size * bytesPerElement
}, 0)
