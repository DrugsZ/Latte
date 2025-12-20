import { describe, it, expect } from 'vitest'
import { hasTrait, isShape, isRenderAble } from '../nodeHelper'
import {
  NodeType,
  TRAIT_SHAPE,
  TRAIT_RENDER_ABLE,
  TRAIT_HAS_BOUNDS,
} from '@latte-js/bean'

describe('NodeHelper', () => {
  describe('hasTrait', () => {
    it('should return true if node has the trait', () => {
      expect(hasTrait(NodeType.RECTANGLE, TRAIT_SHAPE)).toBe(true)
      expect(hasTrait(NodeType.RECTANGLE, TRAIT_RENDER_ABLE)).toBe(true)
      expect(hasTrait(NodeType.FRAME, TRAIT_RENDER_ABLE)).toBe(true)
      expect(hasTrait(NodeType.GROUP, TRAIT_HAS_BOUNDS)).toBe(true)
    })

    it('should return false if node does not have the trait', () => {
      expect(hasTrait(NodeType.DOCUMENT, TRAIT_SHAPE)).toBe(false)
      expect(hasTrait(NodeType.GROUP, TRAIT_RENDER_ABLE)).toBe(false)
      expect(hasTrait(NodeType.DOCUMENT, TRAIT_RENDER_ABLE)).toBe(false)
    })

    it('should return false for unknown node types', () => {
      expect(hasTrait(999, TRAIT_SHAPE)).toBe(false)
    })
  })

  describe('isShape', () => {
    it('should return true for shape nodes', () => {
      expect(isShape(NodeType.RECTANGLE)).toBe(true)
      expect(isShape(NodeType.ELLIPSE)).toBe(true)
      expect(isShape(NodeType.STAR)).toBe(true)
    })

    it('should return false for non-shape nodes', () => {
      expect(isShape(NodeType.FRAME)).toBe(false)
      expect(isShape(NodeType.GROUP)).toBe(false)
      expect(isShape(NodeType.TEXT)).toBe(false)
    })
  })

  describe('isRenderAble', () => {
    it('should return true for renderable nodes', () => {
      expect(isRenderAble(NodeType.RECTANGLE)).toBe(true)
      expect(isRenderAble(NodeType.FRAME)).toBe(true)
      expect(isRenderAble(NodeType.TEXT)).toBe(true)
    })

    it('should return false for non-renderable nodes', () => {
      expect(isRenderAble(NodeType.GROUP)).toBe(false)
      expect(isRenderAble(NodeType.DOCUMENT)).toBe(false)
    })
  })
})
