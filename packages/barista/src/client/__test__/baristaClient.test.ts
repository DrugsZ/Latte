import { Channels } from '@latte-js/bean'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Lifecycle } from '../../lifecycle/lifecycle'
import { BaristaClient } from '../baristaClient'

// Mock MessagePort
class MockMessagePort {
  onmessage: ((e: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  start = vi.fn()
  close = vi.fn()
}

// Mock MessageChannel
class MockMessageChannel {
  port1 = new MockMessagePort()
  port2 = new MockMessagePort()
}

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
}

// Mock ChannelClient
vi.mock('../ipc/channelClient', () => {
  return {
    ChannelClient: vi.fn().mockImplementation(() => ({
      getChannel: vi.fn().mockReturnValue({
        call: vi.fn().mockResolvedValue(undefined),
        listen: vi.fn(),
      }),
    })),
  }
})

describe('BaristaClient', () => {
  let client: BaristaClient
  let mockWorker: MockWorker
  let originalMessageChannel: any

  beforeEach(() => {
    mockWorker = new MockWorker()
    client = new BaristaClient(mockWorker as any)

    // Mock global MessageChannel
    originalMessageChannel = global.MessageChannel
    global.MessageChannel = MockMessageChannel as any
  })

  afterEach(() => {
    global.MessageChannel = originalMessageChannel
  })

  it('should initialize successfully', async () => {
    const sharedBuffer = new SharedArrayBuffer(1024)
    const allocBuffer = new SharedArrayBuffer(1024)

    const initPromise = client.init(sharedBuffer, allocBuffer)

    // Expect worker.postMessage to be called with InitKernel
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: Lifecycle.InitKernel,
        buffer: sharedBuffer,
        allocBuffer,
      }),
      expect.any(Array) // port2
    )

    // Extract requestId from the call
    const callArgs = mockWorker.postMessage.mock.calls[0][0]
    const { requestId } = callArgs

    // Simulate worker response
    if (mockWorker.onmessage) {
      mockWorker.onmessage({
        data: {
          type: Lifecycle.InitKernelSuccess,
          resId: requestId,
          payload: 'success',
        },
      } as MessageEvent)
    }

    const result = await initPromise
    expect(result).toBe('success')
  })

  it('should get service', () => {
    // We need to initialize first to setup channelClient,
    // but getService wraps channelClient.getChannel which might throw if not initialized?
    // Looking at code: client._channelClient is initialized in _initIPC which is called in init()
    // So getService before init will throw undefined error on this._channelClient

    // Let's mock _channelClient being present or just test the flow
    // Since _channelClient is private, we can't easily set it without init.
    // Or we can use 'any' cast.

    const mockChannelClient = {
      getChannel: vi.fn().mockReturnValue({}),
    }
    ;(client as any)._channelClient = mockChannelClient

    const service = client.getService(Channels.Node)
    expect(service).toBeDefined()
    expect(mockChannelClient.getChannel).toHaveBeenCalledWith(Channels.Node)
  })
})
