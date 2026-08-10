import {
  BlendModeType,
  Channels,
  DEFAULT_SCENE_GRAPH_NAME,
  FillType,
  NodeType,
  type IPaint,
} from '@latte-js/bean'
import { NodeCursor, SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { fromService } from '../../ipc'
import { BaristaSystem } from '../../systems'
import { MutationGate } from '../../transactions/mutationPolicy'
import { PropertyService } from '../property'
import { UndoRedoService } from '../undoRedo'

const ctx = (sessionId = '') => ({ sessionId })
type TestContext = {
  sceneGraph: SceneGraph
  mutationAuthority: ReturnType<SceneGraph['createMutationAuthority']>
  accessSystem: BaristaSystem
  currentSessionId: string
  getService: () => never
}

const contextByGraph = new WeakMap<SceneGraph, TestContext>()
const gateByGraph = new WeakMap<SceneGraph, MutationGate>()

const getContext = (graph: SceneGraph): TestContext => {
  let context = contextByGraph.get(graph)
  if (!context) {
    context = {
      sceneGraph: graph,
      mutationAuthority: graph.createMutationAuthority('test'),
      accessSystem: new BaristaSystem(graph),
      currentSessionId: DEFAULT_SCENE_GRAPH_NAME,
      getService: () => {
        throw new Error('getService is not used in property service tests')
      },
    }
    contextByGraph.set(graph, context)
  }
  return context
}

const createGate = (graph: SceneGraph) => {
  let gate = gateByGraph.get(graph)
  if (!gate) {
    gate = new MutationGate(getContext(graph))
    gateByGraph.set(graph, gate)
  }
  return gate
}

const createSolidFill = (r: number): IPaint => ({
  type: FillType.SOLID,
  visible: true,
  opacity: 1,
  blendMode: BlendModeType.NORMAL,
  color: { r, g: 0.25, b: 0.5, a: 1 },
})

describe('PropertyService', () => {
  it('resolves positioning against the current session graph', async () => {
    const graphA = new SceneGraph()
    graphA.createNode(NodeType.RECTANGLE, 'test:a')

    const graphB = new SceneGraph()
    const pageIndex = graphB.createNode(NodeType.CANVAS, 'test:page')
    const rectIndex = graphB.createNode(NodeType.RECTANGLE, 'test:b')
    graphB.appendChild(0, pageIndex)
    graphB.appendChild(pageIndex, rectIndex)
    const rect = new NodeCursor(graphB, rectIndex)
    rect.x = 25

    let currentGraph = graphA
    let currentSessionId = 'doc:a'
    const authorities = new WeakMap<
      SceneGraph,
      ReturnType<SceneGraph['createMutationAuthority']>
    >()
    const dynamicContext = {
      get sceneGraph() {
        return currentGraph
      },
      get mutationAuthority() {
        let authority = authorities.get(currentGraph)
        if (!authority) {
          authority = currentGraph.createMutationAuthority('dynamic-test')
          authorities.set(currentGraph, authority)
        }
        return authority
      },
      get currentSessionId() {
        return currentSessionId
      },
      accessSystem: null as unknown as BaristaSystem,
      getService: () => {
        throw new Error('getService is not used in property service tests')
      },
    }
    dynamicContext.accessSystem = new BaristaSystem(dynamicContext)
    const property = new PropertyService(dynamicContext)

    currentGraph = graphB
    currentSessionId = 'doc:b'
    await property.setProperties(['test:b'], { x: 80 })

    expect(rect.x).toBe(80)
  })

  it('writes P0 properties for multiple nodes as one undoable history step', async () => {
    const graph = new SceneGraph()
    const firstIndex = graph.createNode(NodeType.RECTANGLE, 'test:first')
    const secondIndex = graph.createNode(NodeType.RECTANGLE, 'test:second')
    const first = new NodeCursor(graph, firstIndex)
    const second = new NodeCursor(graph, secondIndex)
    first.x = 10
    first.y = 20
    first.width = 50
    first.height = 40
    second.x = 100
    second.y = 120
    second.width = 75
    second.height = 60
    const fill = createSolidFill(0.9)

    const gate = createGate(graph)
    const property = fromService(new PropertyService(getContext(graph)), {
      channelName: Channels.Property,
      mutationGate: gate,
    })
    const undoRedo = fromService(new UndoRedoService(getContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await property.call(ctx(), 'setProperties', ['test:first', 'test:second'], {
      x: 42,
      width: 120,
      fills: [fill],
      visible: false,
    })

    expect(first.x).toBe(42)
    expect(second.x).toBe(42)
    expect(first.width).toBe(120)
    expect(second.width).toBe(120)
    expect(first.fills).toEqual([fill])
    expect(second.fills).toEqual([fill])
    expect(first.visible).toBe(false)
    expect(second.visible).toBe(false)

    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(first.x).toBe(10)
    expect(second.x).toBe(100)
    expect(first.width).toBe(50)
    expect(second.width).toBe(75)
    expect(first.fills).toEqual([])
    expect(second.fills).toEqual([])
    expect(first.visible).toBe(true)
    expect(second.visible).toBe(true)
    expect(await undoRedo.call(ctx(), 'canUndo')).toBe(false)
  })

  it('applies supported-only descriptors without mutating unsupported targets', async () => {
    const graph = new SceneGraph()
    const rectIndex = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    const textIndex = graph.createNode(NodeType.TEXT, 'test:text')
    const rect = new NodeCursor(graph, rectIndex)
    const text = new NodeCursor(graph, textIndex)
    rect.cornerRadius = [1, 1, 1, 1]
    text.cornerRadius = [0, 0, 0, 0]

    const gate = createGate(graph)
    const property = fromService(new PropertyService(getContext(graph)), {
      channelName: Channels.Property,
      mutationGate: gate,
    })
    const undoRedo = fromService(new UndoRedoService(getContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await property.call(ctx(), 'setProperties', ['test:rect', 'test:text'], {
      cornerRadius: [8, 8, 8, 8],
      opacity: 0.5,
    })

    expect(rect.cornerRadius).toEqual([8, 8, 8, 8])
    expect(text.cornerRadius).toEqual([0, 0, 0, 0])
    expect(rect.opacity).toBe(0.5)
    expect(text.opacity).toBe(0.5)

    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(rect.cornerRadius).toEqual([1, 1, 1, 1])
    expect(text.cornerRadius).toEqual([0, 0, 0, 0])
    expect(rect.opacity).toBe(1)
    expect(text.opacity).toBe(1)
  })

  it('rejects all-required properties without partial mutation or history', async () => {
    const graph = new SceneGraph()
    const rectIndex = graph.createNode(NodeType.RECTANGLE, 'test:rect')
    graph.createNode(NodeType.TEXT, 'test:text')
    const rect = new NodeCursor(graph, rectIndex)
    rect.width = 50
    rect.height = 40

    const gate = createGate(graph)
    const property = fromService(new PropertyService(getContext(graph)), {
      channelName: Channels.Property,
      mutationGate: gate,
    })
    const undoRedo = fromService(new UndoRedoService(getContext(graph)), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    })

    await expect(
      property.call(ctx(), 'setProperties', ['test:rect', 'test:text'], {
        width: 120,
      })
    ).rejects.toThrow('width is unsupported for TEXT')

    expect(rect.width).toBe(50)
    expect(rect.height).toBe(40)
    expect(await undoRedo.call(ctx(), 'canUndo')).toBe(false)
  })

  it('writes containing-parent positions from one snapshot when parent and child are edited together', async () => {
    const graph = new SceneGraph()
    const pageIndex = graph.createNode(NodeType.CANVAS, 'test:page')
    const frameIndex = graph.createNode(NodeType.FRAME, 'test:frame')
    const groupIndex = graph.createNode(NodeType.GROUP, 'test:group')
    const childIndex = graph.createNode(NodeType.RECTANGLE, 'test:child')
    graph.appendChild(0, pageIndex)
    graph.appendChild(pageIndex, frameIndex)
    graph.appendChild(frameIndex, groupIndex)
    graph.appendChild(groupIndex, childIndex)

    const group = new NodeCursor(graph, groupIndex)
    const child = new NodeCursor(graph, childIndex)
    group.x = 20
    group.y = 0
    child.x = 5
    child.y = 0

    const property = fromService(new PropertyService(getContext(graph)), {
      channelName: Channels.Property,
      mutationGate: createGate(graph),
    })

    await property.call(ctx(), 'setProperties', ['test:child', 'test:group'], {
      x: 100,
    })

    expect(group.x).toBe(100)
    expect(child.x).toBe(0)
  })
})
