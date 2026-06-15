import {
  DEFAULT_SCENE_GRAPH_NAME,
  JsonRpcMessageType,
  type JsonRpcMessage,
} from '@latte-js/bean'
import { describe, expect, it, vi } from 'vitest'

import { ChannelClient } from '../channelClient'
import { createJsonRpcNotification } from '../ipc'

import type { IMessagePassingProtocol } from '../protocol/protocol'

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

  public receive(message: JsonRpcMessage) {
    this._listener?.(message)
  }

  public dispose() {
    this._listener = null
  }
}

describe('ChannelClient', () => {
  it('routes event notifications only to listeners registered for the same session', () => {
    const protocol = new MockProtocol()
    const client = new ChannelClient(protocol)
    const onA = vi.fn()
    const onB = vi.fn()

    client.getChannel('node', 'doc:a').listen('onDidCreateNode', onA)
    client.getChannel('node', 'doc:b').listen('onDidCreateNode', onB)

    protocol.receive(
      createJsonRpcNotification(
        'node.onDidCreateNode',
        null,
        { nodes: [['node:a', 1]] },
        'doc:a'
      )
    )

    expect(onA).toHaveBeenCalledWith(
      expect.objectContaining({
        type: JsonRpcMessageType.Notification,
        sessionId: 'doc:a',
        params: { nodes: [['node:a', 1]] },
      })
    )
    expect(onB).not.toHaveBeenCalled()
  })

  it('unlistens using the session captured when the listener was registered', () => {
    const protocol = new MockProtocol()
    const client = new ChannelClient(protocol)
    const disposable = client
      .getChannel('node', 'doc:a')
      .listen('onDidCreateNode', vi.fn())

    client.setTargetSession('doc:b')
    disposable.dispose()

    expect(protocol.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: JsonRpcMessageType.Unlisten,
        sessionId: 'doc:a',
      })
    )
  })

  it('normalizes default listeners to the kernel session used by worker events', () => {
    const protocol = new MockProtocol()
    const client = new ChannelClient(protocol)
    const onDirty = vi.fn()

    client.getChannel('scene', null).listen('onDirty', onDirty)

    expect(protocol.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: JsonRpcMessageType.Listen,
        sessionId: DEFAULT_SCENE_GRAPH_NAME,
      })
    )

    protocol.receive(
      createJsonRpcNotification(
        'scene.onDirty',
        null,
        { ids: ['node:a'] },
        DEFAULT_SCENE_GRAPH_NAME
      )
    )

    expect(onDirty).toHaveBeenCalledTimes(1)
  })
})
