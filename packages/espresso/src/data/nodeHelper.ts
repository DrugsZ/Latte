import {
  NodeType,
  TRAIT_NONE,
  TRAIT_RENDER_ABLE,
  TRAIT_SHAPE,
  TRAIT_TEXT_BASED,
  TRAIT_HAS_BOUNDS,
  TRAIT_EXPORTABLE,
  TRAIT_MASKABLE,
} from '@latte-js/bean'
const NODE_TRAITS = new Uint8Array(256)

// --- C. Register Initialization ---
// This is a pure configuration function, executed once at application startup
function registerTraits() {
  NODE_TRAITS[NodeType.DOCUMENT] = TRAIT_NONE

  const shapeTraits =
    TRAIT_RENDER_ABLE |
    TRAIT_SHAPE |
    TRAIT_HAS_BOUNDS |
    TRAIT_EXPORTABLE |
    TRAIT_MASKABLE
  NODE_TRAITS[NodeType.RECTANGLE] = shapeTraits
  NODE_TRAITS[NodeType.ELLIPSE] = shapeTraits
  NODE_TRAITS[NodeType.STAR] = shapeTraits

  NODE_TRAITS[NodeType.TEXT] =
    TRAIT_RENDER_ABLE | TRAIT_TEXT_BASED | TRAIT_HAS_BOUNDS | TRAIT_EXPORTABLE

  NODE_TRAITS[NodeType.FRAME] =
    TRAIT_RENDER_ABLE | TRAIT_HAS_BOUNDS | TRAIT_EXPORTABLE

  NODE_TRAITS[NodeType.GROUP] = TRAIT_HAS_BOUNDS
}

registerTraits()

export function hasTrait(type: number, trait: number): boolean {
  return (NODE_TRAITS[type] & trait) !== 0
}
export function isShape(type: number): boolean {
  return !!(NODE_TRAITS[type] & TRAIT_SHAPE)
}

export function isRenderAble(type: number): boolean {
  return !!(NODE_TRAITS[type] & TRAIT_RENDER_ABLE)
}
