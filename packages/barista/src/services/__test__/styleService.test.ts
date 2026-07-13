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
import { DocumentService } from '../document'
import { StyleService } from '../style'
import { UndoRedoService } from '../undoRedo'

const ctx = (sessionId = '') => ({ sessionId })

const createContext = (graph: SceneGraph) => ({
  sceneGraph: graph,
  mutationAuthority: graph.createMutationAuthority('test'),
  accessSystem: new BaristaSystem(graph),
  currentSessionId: DEFAULT_SCENE_GRAPH_NAME,
  getService: () => {
    throw new Error('getService is not used in style service tests')
  },
})

const createFixture = () => {
  const graph = new SceneGraph()
  const page = graph.createNode(NodeType.CANVAS, 'test:page')
  graph.appendChild(0, page)
  const rect = graph.createNode(NodeType.RECTANGLE, 'test:rect')
  graph.appendChild(page, rect)
  return { graph, page, rect }
}

const createDynamicContext = (initialGraph: SceneGraph) => {
  let currentSessionId = DEFAULT_SCENE_GRAPH_NAME
  let currentGraph = initialGraph
  const authorities = new WeakMap<
    SceneGraph,
    ReturnType<SceneGraph['createMutationAuthority']>
  >()
  const getAuthority = (graph: SceneGraph) => {
    let authority = authorities.get(graph)
    if (!authority) {
      authority = graph.createMutationAuthority(
        `StyleService:${currentSessionId}`
      )
      authorities.set(graph, authority)
    }
    return authority
  }

  const context = {
    get sceneGraph() {
      return currentGraph
    },
    get mutationAuthority() {
      return getAuthority(currentGraph)
    },
    get currentSessionId() {
      return currentSessionId
    },
    accessSystem: new BaristaSystem(currentGraph),
    getService: () => {
      throw new Error('getService is not used in style service tests')
    },
    switchTo(sessionId: string, graph: SceneGraph) {
      currentSessionId = sessionId
      currentGraph = graph
      context.accessSystem = new BaristaSystem(currentGraph)
    },
  }

  return context
}

const createChannels = (graph: SceneGraph) => {
  const context = createContext(graph)
  const gate = new MutationGate(context)
  return {
    style: fromService(new StyleService(context), {
      channelName: Channels.Style,
      mutationGate: gate,
    }),
    undoRedo: fromService(new UndoRedoService(context), {
      channelName: Channels.UndoRedo,
      mutationGate: gate,
    }),
    document: fromService(new DocumentService(context), {
      channelName: Channels.Document,
      mutationGate: gate,
    }),
  }
}

const solidFill = (r: number, g: number, b: number): IPaint => ({
  type: FillType.SOLID,
  visible: true,
  opacity: 1,
  blendMode: BlendModeType.NORMAL,
  color: { r, g, b, a: 1 },
})

describe('StyleService', () => {
  it('uses the active session graph instead of a constructor-time graph', async () => {
    const defaultGraph = new SceneGraph()
    const active = createFixture()
    const context = createDynamicContext(defaultGraph)
    const gate = new MutationGate(context)
    const style = fromService(new StyleService(context), {
      channelName: Channels.Style,
      mutationGate: gate,
    })
    const fill = solidFill(1, 0, 0)

    context.switchTo('document:1', active.graph)

    await style.call({ sessionId: 'document:1' }, 'setFill', 'test:rect', fill)

    expect(new NodeCursor(active.graph, active.rect).fills).toEqual([fill])
  })

  it('writes fill through worker-owned history', async () => {
    const { graph, rect } = createFixture()
    const cursor = new NodeCursor(graph, rect)
    const { style, undoRedo } = createChannels(graph)
    const fill = solidFill(1, 0, 0)

    await style.call(ctx(), 'setFill', 'test:rect', fill)

    expect(cursor.fills).toEqual([fill])
    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(cursor.fills).toEqual([])
    expect(await undoRedo.call(ctx(), 'redo')).toBe(true)
    expect(cursor.fills).toEqual([fill])
  })

  it('clears fill through worker-owned history', async () => {
    const { graph, rect } = createFixture()
    const cursor = new NodeCursor(graph, rect)
    const fill = solidFill(0, 1, 0)
    cursor.fills = [fill]
    const { style, undoRedo } = createChannels(graph)

    await style.call(ctx(), 'clearFill', 'test:rect')

    expect(cursor.fills).toEqual([])
    expect(await undoRedo.call(ctx(), 'undo')).toBe(true)
    expect(cursor.fills).toEqual([fill])
  })

  it('preserves fill through save and load', async () => {
    const { graph } = createFixture()
    const { style, document } = createChannels(graph)
    const fill = solidFill(0, 0, 1)

    await style.call(ctx(), 'setFill', 'test:rect', fill)
    const data = await document.call(ctx(), 'save')

    const loadedGraph = new SceneGraph()
    const { document: loadedDocument } = createChannels(loadedGraph)
    await loadedDocument.call(ctx(), 'load', data)
    const loadedRect = loadedGraph.getIndex('test:rect')

    expect(new NodeCursor(loadedGraph, loadedRect).fills).toEqual([fill])
  })
})
