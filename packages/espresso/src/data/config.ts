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

// Dirty flags describe which downstream pipeline needs invalidation.
// PropId/mutation records describe what changed.
export const DIRTY_LOCAL_MATRIX = 1 << 0 // local matrix changed
export const DIRTY_PAINT = 1 << 1 // visual paint/compositing changed
export const DIRTY_TREE = 1 << 2 // parent/child/order changed
export const DIRTY_WORLD_BOUNDS = 1 << 3 // derived world bounds invalidated
export const DIRTY_TEXT = 1 << 4 // text content/style/layout changed
export const DIRTY_METADATA = 1 << 5 // name/lock/plugin metadata changed
export const DIRTY_SUBTREE_MATRIX = 1 << 6 // subtree has matrix-affecting changes
export const DIRTY_GEOMETRY = 1 << 7 // local shape/size/path changed
export const DIRTY_LAYOUT = 1 << 8 // layout constraints/autolayout invalidated
export const DIRTY_EFFECT = 1 << 9 // blur/shadow/filter may affect visual bounds

export const MATRIX_AFFECTING_FLAGS = DIRTY_LOCAL_MATRIX | DIRTY_TREE

export const BOUNDS_AFFECTING_FLAGS =
  DIRTY_LOCAL_MATRIX |
  DIRTY_GEOMETRY |
  DIRTY_TREE |
  DIRTY_TEXT |
  DIRTY_EFFECT |
  DIRTY_WORLD_BOUNDS

export const RENDER_AFFECTING_FLAGS =
  BOUNDS_AFFECTING_FLAGS | DIRTY_PAINT | DIRTY_LAYOUT

export const LAYOUT_AFFECTING_FLAGS =
  DIRTY_GEOMETRY | DIRTY_TREE | DIRTY_TEXT | DIRTY_LAYOUT

export const BIT_IS_CONTAINER = 0b10000000

export const DEFAULT_HEAP_SIZE = 1024 * 1024 * 10 // default 10MB

const isLittleEndian = () => {
  const arr = new Uint16Array([1])
  const bytes = new Uint8Array(arr.buffer)
  return bytes[0] === 1
}

export const LITTLE_ENDIAN = isLittleEndian() ? 4 : 8 // window is use little endian, but if ssr, should get endian
