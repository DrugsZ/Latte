import { describe, expect, it, vi } from 'vitest'
import {
  Channels,
  JsonRpcMessageType,
  NodeType,
  DEFAULT_SCENE_GRAPH_NAME,
  type IDType,
  type JsonRpcMessage,
} from '@latte-js/bean'
import {
  DEFAULT_HEAP_SIZE,
  MAX_NODES,
  TOTAL_MEMORY_BYTES,
  NodeCursor,
  SceneGraph,
} from '@latte-js/espresso'

import { BaristaEngine } from '../baristaEngine'
import { BaristaSessionManager } from '../baristaSessionManager'
import {
  createJsonRpcListenMessage,
  createJsonRpcRequest,
  createJsonRpcUnlistenMessage,
} from '../../ipc/ipc'

import type { IMessagePassingProtocol } from '../../ipc/protocol/protocol'

class MockProtocol implements IMessagePassingProtocol {
  public readonly send = vi.fn()
  private _listener: ((data: JsonRpcMessage) => void) | null = null

  public onMessage(listener: (data: JsonRpcMessage) => void) {
    this._listener = listener
    return {
      dispose: () => {
        this._listener = null
      },
    }
  }

  public dispose() {
    this._listener = null
  }

  public async receive(message: JsonRpcMessage) {
    const result = this._listener?.(message)
    await result
    await Promise.resolve()
  }
}

function createEngine(protocol = new MockProtocol()) {
  return new BaristaEngine(
    new SharedArrayBuffer(TOTAL_MEMORY_BYTES),
    protocol,
    new SharedArrayBuffer(MAX_NODES),
    new SharedArrayBuffer(DEFAULT_HEAP_SIZE)
  )
}

function createEngineWithProtocol() {
  const protocol = new MockProtocol()
  const engine = createEngine(protocol)
  return { engine, protocol }
}

function createSessionBuffers() {
  return {
    buffer: new SharedArrayBuffer(TOTAL_MEMORY_BYTES),
    allocBuffer: new SharedArrayBuffer(MAX_NODES),
    heapBuffer: new SharedArrayBuffer(DEFAULT_HEAP_SIZE),
  }
}

describe('BaristaEngine', () => {
  it('registers lifecycle listeners in the requested document session and delivers projection ids', async () => {
    const { engine, protocol } = createEngineWithProtocol()
    const docA = createSessionBuffers()
    engine.initSession('doc:a', docA.buffer, docA.allocBuffer, docA.heapBuffer)
    const projection = new SceneGraph(
      docA.buffer,
      docA.allocBuffer,
      docA.heapBuffer
    )
    await protocol.receive(
      createJsonRpcListenMessage(
        `${Channels.Node}.onDidCreateNode`,
        100,
        undefined,
        'doc:a'
      )
    )
    await protocol.receive(
      createJsonRpcRequest(
        `${Channels.Node}.createNode`,
        1,
        [
          {
            id: 'node:created',
            type: NodeType.RECTANGLE,
            name: 'New rectangle',
            x: 24,
            y: 36,
          },
        ],
        'doc:a'
      )
    )

    const notifications = protocol.send.mock.calls
      .map(([message]) => message as JsonRpcMessage)
      .filter(
        message =>
          message.type === JsonRpcMessageType.Notification &&
          message.method === 'node.onDidCreateNode'
      )
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      sessionId: 'doc:a',
      params: { nodes: [['node:created', 1]] },
    })
    expect(projection.getIndex('node:created')).toBe(-1)
    const changes = (notifications[0] as any).params.nodes as [IDType, number][]
    for (const [id, index] of changes) projection.registerIdMap(id, index)
    const cursor = new NodeCursor(
      projection,
      projection.getIndex('node:created')
    )
    expect(cursor.name).toBe('New rectangle')
    expect([cursor.x, cursor.y]).toEqual([24, 36])
  })

  it('isolates lifecycle subscriptions between documents and releases a listener on unlisten', async () => {
    const { engine, protocol } = createEngineWithProtocol()
    for (const session of ['doc:a', 'doc:b']) {
      const buffers = createSessionBuffers()
      engine.initSession(
        session,
        buffers.buffer,
        buffers.allocBuffer,
        buffers.heapBuffer
      )
    }
    for (const [id, session] of [
      [100, 'doc:a'],
      [101, 'doc:b'],
      [102, DEFAULT_SCENE_GRAPH_NAME],
    ] as const) {
      await protocol.receive(
        createJsonRpcListenMessage(
          `${Channels.Node}.onDidCreateNode`,
          id,
          undefined,
          session
        )
      )
    }
    for (const [id, session] of [
      [1, 'doc:a'],
      [2, 'doc:b'],
    ] as const) {
      await protocol.receive(
        createJsonRpcRequest(
          `${Channels.Node}.createNode`,
          id,
          [{ id: 'node:shared-id', type: NodeType.RECTANGLE }],
          session
        )
      )
    }
    const created = () =>
      protocol.send.mock.calls
        .map(([message]) => message as JsonRpcMessage)
        .filter(
          message =>
            message.type === JsonRpcMessageType.Notification &&
            message.method === 'node.onDidCreateNode'
        )
    expect(created().map(message => message.sessionId)).toEqual([
      'doc:a',
      'doc:b',
    ])
    await protocol.receive(createJsonRpcUnlistenMessage(100, 'doc:a'))
    await protocol.receive(
      createJsonRpcRequest(
        `${Channels.Node}.createNode`,
        3,
        [{ id: 'node:after-unlisten', type: NodeType.RECTANGLE }],
        'doc:a'
      )
    )
    expect(created()).toHaveLength(2)
  })

  it('rejects duplicate session ids', () => {
    const engine = createEngine()
    const sessionId = 'session:duplicate'
    const first = createSessionBuffers()

    engine.initSession(
      sessionId,
      first.buffer,
      first.allocBuffer,
      first.heapBuffer
    )

    expect(() =>
      engine.initSession(
        sessionId,
        first.buffer,
        first.allocBuffer,
        first.heapBuffer
      )
    ).toThrow('[BaristaEngine] Session already exists: session:duplicate')
  })

  it('rejects RPC calls for unknown sessions', async () => {
    const { protocol } = createEngineWithProtocol()

    await protocol.receive(
      createJsonRpcRequest(
        `${Channels.Node}.createNode`,
        1,
        [{ id: 'node:missing', type: NodeType.RECTANGLE, x: 10, y: 20 }],
        'session:missing'
      )
    )

    const errorResponse = protocol.send.mock.calls
      .map(([message]) => message as JsonRpcMessage)
      .find(message => message.type === JsonRpcMessageType.ResponseError)

    expect((errorResponse as any).error.message).toBe(
      '[BaristaEngine] Unknown session: session:missing'
    )
  })

  it('routes dirty notifications through each real session graph', async () => {
    const { engine, protocol } = createEngineWithProtocol()
    const docA = createSessionBuffers()
    const docB = createSessionBuffers()

    engine.initSession('doc:a', docA.buffer, docA.allocBuffer, docA.heapBuffer)
    engine.initSession('doc:b', docB.buffer, docB.allocBuffer, docB.heapBuffer)

    await protocol.receive(
      createJsonRpcRequest(
        `${Channels.Node}.createNode`,
        1,
        [{ id: 'node:a', type: NodeType.RECTANGLE, x: 10, y: 20 }],
        'doc:a'
      )
    )
    await protocol.receive(
      createJsonRpcRequest(
        `${Channels.Node}.createNode`,
        2,
        [{ id: 'node:b', type: NodeType.RECTANGLE, x: 30, y: 40 }],
        'doc:b'
      )
    )

    const dirtyNotifications = protocol.send.mock.calls
      .map(([message]) => message as JsonRpcMessage)
      .filter(
        message =>
          message.type === JsonRpcMessageType.Notification &&
          message.method === 'scene.onDirty'
      )

    expect(dirtyNotifications.map(message => message.sessionId)).toEqual([
      'doc:a',
      'doc:b',
    ])
    expect((dirtyNotifications[0] as any).params.allIds).toEqual(['node:a'])
    expect((dirtyNotifications[1] as any).params.allIds).toEqual(['node:b'])
  })

  it('keeps session context isolated for queued concurrent RPC messages', async () => {
    const { engine, protocol } = createEngineWithProtocol()
    const docA = createSessionBuffers()
    const docB = createSessionBuffers()

    engine.initSession('doc:a', docA.buffer, docA.allocBuffer, docA.heapBuffer)
    engine.initSession('doc:b', docB.buffer, docB.allocBuffer, docB.heapBuffer)

    await Promise.all([
      protocol.receive(
        createJsonRpcRequest(
          `${Channels.Node}.createNode`,
          1,
          [{ id: 'node:a', type: NodeType.RECTANGLE }],
          'doc:a'
        )
      ),
      protocol.receive(
        createJsonRpcRequest(
          `${Channels.Node}.createNode`,
          2,
          [{ id: 'node:b', type: NodeType.RECTANGLE }],
          'doc:b'
        )
      ),
    ])

    const dirtyNotifications = protocol.send.mock.calls
      .map(([message]) => message as JsonRpcMessage)
      .filter(
        message =>
          message.type === JsonRpcMessageType.Notification &&
          message.method === 'scene.onDirty'
      )

    expect(dirtyNotifications.map(message => message.sessionId)).toEqual([
      'doc:a',
      'doc:b',
    ])
  })
})

describe('BaristaSessionManager', () => {
  it('scopes execution context and restores it after nested calls', () => {
    const manager = new BaristaSessionManager()
    const docA = createSessionBuffers()
    const docB = createSessionBuffers()

    manager.initSession('doc:a', docA.buffer, docA.allocBuffer, docA.heapBuffer)
    manager.initSession('doc:b', docB.buffer, docB.allocBuffer, docB.heapBuffer)

    manager.runWithContext(manager.getContext('doc:a'), () => {
      expect(manager.currentSessionId).toBe('doc:a')
      manager.runWithContext(manager.getContext('doc:b'), () => {
        expect(manager.currentSessionId).toBe('doc:b')
      })
      expect(manager.currentSessionId).toBe('doc:a')
    })
  })

  it('restores execution context after errors', () => {
    const manager = new BaristaSessionManager()
    const docA = createSessionBuffers()
    const docB = createSessionBuffers()

    manager.initSession('doc:a', docA.buffer, docA.allocBuffer, docA.heapBuffer)
    manager.initSession('doc:b', docB.buffer, docB.allocBuffer, docB.heapBuffer)

    manager.runWithContext(manager.getContext('doc:a'), () => {
      expect(() =>
        manager.runWithContext(manager.getContext('doc:b'), () => {
          throw new Error('boom')
        })
      ).toThrow('boom')
      expect(manager.currentSessionId).toBe('doc:a')
    })
  })
})
