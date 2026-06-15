import { NodeType } from '@latte-js/bean'
import {
  DIRTY_LOCAL_MATRIX,
  DIRTY_METADATA,
  SceneGraph,
} from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { DirtyBatch } from '../dirtyBatch'
import { NotificationPlanner } from '../notificationPlanner'

describe('NotificationPlanner', () => {
  it('separates render ids from all dirty ids', () => {
    const graph = new SceneGraph()
    const renderNode = graph.createNode(NodeType.RECTANGLE, 'test:render')
    const metadataNode = graph.createNode(NodeType.RECTANGLE, 'test:metadata')
    const planner = new NotificationPlanner(graph)
    const batch = DirtyBatch.from(
      new Map([
        [renderNode, DIRTY_LOCAL_MATRIX],
        [metadataNode, DIRTY_METADATA],
      ])
    )

    const payload = planner.createDirtyPayload(batch, 7)

    expect(payload).toEqual({
      version: 7,
      ids: ['test:render'],
      renderIds: ['test:render'],
      allIds: ['test:render', 'test:metadata'],
      nodes: [
        { id: 'test:render', flags: DIRTY_LOCAL_MATRIX },
        { id: 'test:metadata', flags: DIRTY_METADATA },
      ],
    })
  })
})
