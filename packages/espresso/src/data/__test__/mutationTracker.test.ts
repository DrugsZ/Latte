import { describe, it, expect } from 'vitest'
import { MutationTracker } from '../mutationTracker'

describe('MutationTracker', () => {
  it('should mark nodes as dirty', () => {
    const tracker = new MutationTracker()
    tracker.mark(1, 1)
    tracker.mark(1, 2)
    tracker.mark(2, 4)

    expect(tracker.hasChanges).toBe(true)
    const snapshot = tracker.popAll()
    expect(snapshot.get(1)).toBe(3)
    expect(snapshot.get(2)).toBe(4)
    expect(tracker.hasChanges).toBe(false)
  })

  it('should clear dirty nodes after popAll', () => {
    const tracker = new MutationTracker()
    tracker.mark(1, 1)
    tracker.popAll()
    expect(tracker.hasChanges).toBe(false)
    expect(tracker.popAll().size).toBe(0)
  })
})
