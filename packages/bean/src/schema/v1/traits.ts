export const TRAIT_NONE = 0
export const TRAIT_RENDER_ABLE = 1 << 0 // Canvas draw call
export const TRAIT_SHAPE = 1 << 1 // has Path, Fill, Stroke
export const TRAIT_TEXT_BASED = 1 << 2 // contains text content (points to TextHeap)
export const TRAIT_HAS_BOUNDS = 1 << 3 // occupies physical space (has Width/Height)
export const TRAIT_EXPORTABLE = 1 << 4 // can be exported as an image
export const TRAIT_MASKABLE = 1 << 5 // can be used as a mask
// --- B. Lookup Table ---
// Space for time: 256 bytes of minimal memory overhead
