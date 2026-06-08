import { describe, expect, it } from 'vitest'

import {
  DIRTY_LOCAL_MATRIX,
  DIRTY_METADATA,
  DIRTY_SUBTREE_MATRIX,
  DIRTY_TREE,
  NULL_INDEX,
} from '../config'
import { MutationTracker } from '../mutationTracker'

describe('MutationTracker', () => {
  it('should mark nodes as dirty', () => {
    const tracker = new MutationTracker()
    tracker.mark(1, 1)
    tracker.mark(1, 2)
    tracker.mark(2, 4)

    expect(tracker.hasChanges).toBe(true)
    const snapshot = tracker.flush()
    expect(snapshot.get(1)).toBe(3)
    expect(snapshot.get(2)).toBe(4)
    expect(tracker.hasChanges).toBe(false)
  })

  it('should clear dirty nodes after popAll', () => {
    const tracker = new MutationTracker()
    tracker.mark(1, 1)
    tracker.flush()
    expect(tracker.hasChanges).toBe(false)
    expect(tracker.flush().size).toBe(0)
  })

  it('bubbles matrix-affecting dirty flags to ancestors', () => {
    const tracker = new MutationTracker()
    const parent = new Int32Array([NULL_INDEX, 0, 1])
    tracker.setParentArray(parent)

    tracker.mark(2, DIRTY_LOCAL_MATRIX)

    const snapshot = tracker.flush()
    expect(snapshot.get(2)! & DIRTY_LOCAL_MATRIX).toBe(DIRTY_LOCAL_MATRIX)
    expect(snapshot.get(1)! & DIRTY_SUBTREE_MATRIX).toBe(DIRTY_SUBTREE_MATRIX)
    expect(snapshot.get(0)! & DIRTY_SUBTREE_MATRIX).toBe(DIRTY_SUBTREE_MATRIX)
  })

  it('does not bubble non-matrix dirty flags', () => {
    const tracker = new MutationTracker()
    const parent = new Int32Array([NULL_INDEX, 0, 1])
    tracker.setParentArray(parent)

    tracker.mark(2, DIRTY_METADATA)

    const snapshot = tracker.flush()
    expect(snapshot.get(2)).toBe(DIRTY_METADATA)
    expect(snapshot.has(1)).toBe(false)
    expect(snapshot.has(0)).toBe(false)
  })

  it('returns a defensive snapshot copy', () => {
    const tracker = new MutationTracker()
    tracker.mark(1, DIRTY_METADATA)

    const snapshot = tracker.getSnapshot()
    snapshot.clear()

    expect(tracker.flush().get(1)).toBe(DIRTY_METADATA)
  })

  it('throws a clear error when parent bubbling sees a cycle', () => {
    const tracker = new MutationTracker()
    const parent = new Int32Array([2, 0, 1])
    tracker.setParentArray(parent)

    expect(() => tracker.mark(2, DIRTY_TREE)).toThrow('Tree cycle detected')
  })
})
