import { describe, expect, it } from 'vitest'

import { SceneGraph } from '../sceneGraph'

describe('SceneGraph publication revision', () => {
  it('uses odd revisions while writes are in progress and even revisions when published', () => {
    const graph = new SceneGraph()

    expect(graph.publicationRevision).toBe(0)
    expect(graph.isPublicationWriting).toBe(false)

    expect(graph.beginPublicationWrite()).toBe(1)
    expect(graph.publicationRevision).toBe(1)
    expect(graph.isPublicationWriting).toBe(true)
    expect(graph.readConsistent(() => 'stale')).toBeNull()

    expect(graph.publishRevision()).toBe(2)
    expect(graph.publicationRevision).toBe(2)
    expect(graph.isPublicationWriting).toBe(false)
    expect(graph.readConsistent(() => 'fresh')).toBe('fresh')
  })

  it('discards reads when the revision changes during the read', () => {
    const graph = new SceneGraph()

    expect(
      graph.readConsistent(() => {
        graph.beginPublicationWrite()
        graph.publishRevision()
        return 'raced'
      })
    ).toBeNull()
  })
})
