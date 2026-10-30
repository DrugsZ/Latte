import {
  BlendModeType,
  Channels,
  DEFAULT_SCENE_GRAPH_NAME,
  FillType,
  NodeType,
  type IStylePatch,
  type ISolidColorPaint,
} from '@latte-js/bean'
import {
  DIRTY_METADATA,
  DIRTY_PAINT,
  NodeCursor,
  SceneGraph,
} from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { fromService } from '../../ipc'
import { BaristaSystem } from '../../systems'
import { MutationGate } from '../../transactions/mutationPolicy'
import { StyleService } from '../style'
import { UndoRedoService } from '../undoRedo'

const solid = (): ISolidColorPaint => ({
  type: FillType.SOLID,
  visible: true,
  opacity: 1,
  blendMode: BlendModeType.NORMAL,
  color: { r: 0.2, g: 0.4, b: 0.8, a: 1 },
})

const setup = () => {
  const graph = new SceneGraph()
  const first = new NodeCursor(
    graph,
    graph.createNode(NodeType.RECTANGLE, 'test:first')
  )
  const second = new NodeCursor(
    graph,
    graph.createNode(NodeType.RECTANGLE, 'test:second')
  )
  first.name = 'First'
  second.name = 'Second'
  graph.tracker.flush()
  const context = {
    sceneGraph: graph,
    mutationAuthority: graph.createMutationAuthority('style-test'),
    accessSystem: new BaristaSystem(graph),
    currentSessionId: DEFAULT_SCENE_GRAPH_NAME,
    getService: () => {
      throw new Error('getService is not used in style service tests')
    },
  }
  const gate = new MutationGate(context)
  const style = fromService(new StyleService(context), {
    channelName: Channels.Style,
    mutationGate: gate,
  })
  const history = fromService(new UndoRedoService(context), {
    channelName: Channels.UndoRedo,
    mutationGate: gate,
  })
  const callContext = { sessionId: DEFAULT_SCENE_GRAPH_NAME }
  const update = (ids: string[], patch: IStylePatch) =>
    style.call(callContext, 'update', ids, patch)
  return { graph, first, second, update, history, callContext }
}

describe('StyleService', () => {
  it('edits a selection in one history entry and restores every property', async () => {
    const { first, second, update, history, callContext } = setup()
    const fills = [solid()]
    await update(['test:first', 'test:second'], {
      name: 'Edited',
      fills,
      opacity: 0.5,
      visible: false,
      locked: true,
    })

    for (const cursor of [first, second]) {
      expect(cursor.name).toBe('Edited')
      expect(cursor.fills).toEqual(fills)
      expect(cursor.opacity).toBeCloseTo(0.5)
      expect(cursor.visible).toBe(false)
      expect(cursor.locked).toBe(true)
    }

    expect(await history.call(callContext, 'undo')).toBe(true)
    expect(first.name).toBe('First')
    expect(second.name).toBe('Second')
    for (const cursor of [first, second]) {
      expect(cursor.fills).toEqual([])
      expect(cursor.opacity).toBe(1)
      expect(cursor.visible).toBe(true)
      expect(cursor.locked).toBe(false)
    }
    expect(await history.call(callContext, 'canUndo')).toBe(false)

    expect(await history.call(callContext, 'redo')).toBe(true)
    expect(first.name).toBe('Edited')
    expect(second.name).toBe('Edited')
    expect(first.fills).toEqual(fills)
    expect(first.opacity).toBeCloseTo(0.5)
  })

  it('reports metadata and paint dirty flags and exposes blobs to another projection', async () => {
    const { graph, first, update } = setup()
    const projection = new SceneGraph(
      graph.buffer,
      graph.allocator.buffer,
      graph.heap.buffer
    )
    const projected = new NodeCursor(projection, first.index)
    await update(['test:first'], { name: 'Shared name', fills: [solid()] })

    expect(projected.name).toBe('Shared name')
    expect(projected.fills).toEqual([solid()])
    const dirty = graph.tracker.flush()
    expect(dirty).toContainEqual([first.index, DIRTY_METADATA | DIRTY_PAINT])
  })

  it('validates all targets before modifying any node', async () => {
    const { first, update, history, callContext } = setup()
    await expect(
      update(['test:first', 'test:missing'], { name: 'Should not apply' })
    ).rejects.toThrow('Node not found')
    expect(first.name).toBe('First')
    expect(await history.call(callContext, 'canUndo')).toBe(false)
  })

  it.each([
    { opacity: Number.NaN },
    { opacity: -0.1 },
    { opacity: 1.1 },
    { visible: 'yes' },
    { name: 42 },
    { fills: [null] },
    { fills: [{ ...solid(), color: { r: 3, g: 0, b: 0, a: 1 } }] },
    { fills: [{ ...solid(), type: FillType.IMAGE }] },
    { unsupported: true },
  ])(
    'rejects an invalid patch before applying its valid fields: %j',
    async patch => {
      const { first, update, history, callContext } = setup()
      await expect(
        update(['test:first'], { name: 'Changed', ...patch } as IStylePatch)
      ).rejects.toThrow('[StyleService]')
      expect(first.name).toBe('First')
      expect(first.opacity).toBe(1)
      expect(first.fills).toEqual([])
      expect(await history.call(callContext, 'canUndo')).toBe(false)
    }
  )

  it('does not retain mutable references to incoming paint payloads', async () => {
    const { first, update } = setup()
    const paint = solid()
    await update(['test:first'], { fills: [paint] })
    paint.color.r = 1
    expect(first.fills).toEqual([solid()])
  })

  it('does not create history for an unchanged scalar patch', async () => {
    const { update, history, callContext } = setup()
    await update(['test:first'], { name: 'First', opacity: 1 })
    expect(await history.call(callContext, 'canUndo')).toBe(false)
  })
})
