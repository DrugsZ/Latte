const DEFAULT_MAX_NODES = 1000000
const TEST_MAX_NODES = 20000

const readConfiguredMaxNodes = () => {
  const env = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>
      }
    }
  ).process?.env
  const raw = env?.LATTE_MAX_NODES
  const configured = raw ? Number(raw) : NaN
  if (Number.isInteger(configured) && configured > 1) {
    return configured
  }
  if (env?.VITEST || env?.NODE_ENV === 'test') {
    return TEST_MAX_NODES
  }
  return DEFAULT_MAX_NODES
}

export const MAX_NODES = readConfiguredMaxNodes()
export const NULL_INDEX = -1

export const MAT_A = 0
export const MAT_B = 1
export const MAT_C = 2
export const MAT_D = 3
export const MAT_TX = 4
export const MAT_TY = 5
export const MAT_SIZE = 6

export const AABB_SIZE = 4

export const PARENT_INDEX_SIZE = 1
export const FIRST_CHILD_INDEX_SIZE = 1
export const NEXT_SIBLING_INDEX_SIZE = 1
export const PREV_SIBLING_INDEX_SIZE = 1
export const LAST_CHILD_INDEX_SIZE = 1

export const SIZE_SIZE = 2

export const TYPE_SIZE = 1
export const VISIBLE_SIZE = 1
export const OPACITY_SIZE = 1
export const TEXT_PTR_SIZE = 1

export const DIRTY_TRANSFORM = 1 << 0 // x, y, w, h, rotation
export const DIRTY_STYLE = 1 << 1 // color, stroke
export const DIRTY_STRUCTURE = 1 << 2 // add, remove
export const DIRTY_AABB = 1 << 3 // DIRTY_AABB
export const DIRTY_TEXT = 1 << 4 // text content
export const DIRTY_NOT_EFFECT = 1 << 5 // not effect on layout
export const DIRTY_SUBTREE_MATRIX = 1 << 6 // subtree has transform changes

// Flags that affect world transform calculation
export const MATRIX_AFFECTING_FLAGS = DIRTY_TRANSFORM | DIRTY_STRUCTURE

// Flags that affect bounds/AABB calculation
export const BOUNDS_AFFECTING_FLAGS =
  DIRTY_TRANSFORM | DIRTY_STRUCTURE | DIRTY_STYLE | DIRTY_TEXT | DIRTY_AABB

export const BIT_IS_CONTAINER = 0b10000000

export const DEFAULT_HEAP_SIZE = 1024 * 1024 * 10 // default 10MB

const isLittleEndian = () => {
  const arr = new Uint16Array([1])
  const bytes = new Uint8Array(arr.buffer)
  return bytes[0] === 1
}

export const LITTLE_ENDIAN = isLittleEndian() ? 4 : 8 // window is use little endian, but if ssr, should get endian
