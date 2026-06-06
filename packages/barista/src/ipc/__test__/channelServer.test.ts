import {
  JsonRpcErrorCode,
  JsonRpcMessageType,
  LATTE_RPC_PROTOCOL_VERSION,
  type JsonRpcMessage,
} from '@latte-js/bean'
import { describe, expect, it, vi } from 'vitest'

import { ChannelServer } from '../channelServer'

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

  public dispose() {
    this._listener = null
  }
}

describe('ChannelServer', () => {
  it('processes calls sequentially to avoid service interleaving', async () => {
    const protocol = new MockProtocol()
    const server = new ChannelServer(protocol)
    const calls: string[] = []
    let releaseSlowCall!: () => void

    server.registerChannel('test', {
      async call<T>(_ctx, command) {
        calls.push(command)
        if (command === 'slow') {
          await new Promise<void>(resolve => {
            releaseSlowCall = resolve
          })
        }
        return command as T
      },
      listen() {
        throw new Error('listen is not used in this test')
      },
    })

    const slow = server.handleMessage({
      jsonrpc: '2.0',
      type: JsonRpcMessageType.Request,
      method: 'test.slow',
      params: [],
      id: 1,
    })
    const fast = server.handleMessage({
      jsonrpc: '2.0',
      type: JsonRpcMessageType.Request,
      method: 'test.fast',
      params: [],
      id: 2,
    })

    await Promise.resolve()
    expect(calls).toEqual(['slow'])

    releaseSlowCall()
    await Promise.all([slow, fast])
    expect(calls).toEqual(['slow', 'fast'])
  })

  it('rejects requests with an unsupported protocol version', async () => {
    const protocol = new MockProtocol()
    const server = new ChannelServer(protocol)

    await server.handleMessage({
      jsonrpc: '2.0',
      type: JsonRpcMessageType.Request,
      protocolVersion: LATTE_RPC_PROTOCOL_VERSION + 1,
      method: 'test.fast',
      params: [],
      id: 1,
    })

    expect(protocol.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: JsonRpcMessageType.ResponseError,
        error: expect.objectContaining({
          code: JsonRpcErrorCode.ProtocolVersionMismatch,
          data: {
            expected: LATTE_RPC_PROTOCOL_VERSION,
            actual: LATTE_RPC_PROTOCOL_VERSION + 1,
          },
        }),
      })
    )
  })

  it('reports notification errors through rpc.onError', async () => {
    const protocol = new MockProtocol()
    const server = new ChannelServer(protocol)

    await server.handleMessage({
      jsonrpc: '2.0',
      type: JsonRpcMessageType.Notification,
      protocolVersion: LATTE_RPC_PROTOCOL_VERSION,
      method: 'missing.call',
      params: [],
      id: null,
    })

    expect(protocol.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: JsonRpcMessageType.Notification,
        method: 'rpc.onError',
        params: expect.objectContaining({
          error: expect.objectContaining({
            code: JsonRpcErrorCode.NotificationError,
          }),
        }),
      })
    )
  })

  it('accepts engine-owned scene notification listeners without a service channel', async () => {
    const protocol = new MockProtocol()
    const server = new ChannelServer(protocol)

    await server.handleMessage({
      jsonrpc: '2.0',
      type: JsonRpcMessageType.Listen,
      protocolVersion: LATTE_RPC_PROTOCOL_VERSION,
      method: 'scene.onDirty',
      params: [],
      id: 1,
    })

    expect(protocol.send).not.toHaveBeenCalled()
  })
})
