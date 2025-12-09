export const MAX_NODES = 1000000
export const NULL_INDEX = -1

export const MAT_A = 0
export const MAT_B = 1
export const MAT_C = 2
export const MAT_D = 3
export const MAT_TX = 4
export const MAT_TY = 5
export const MAT_SIZE = 6

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
export const DIRTY_TEXT = 1 << 3 // test  content

export const BIT_IS_CONTAINER = 0b10000000
