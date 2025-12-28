import { SceneGraph, TOTAL_MEMORY_BYTES } from '@latte-js/espresso'
import { BaristaClient } from '@latte-js/barista'

import BaristaWorker from '@latte-js/barista/worker?worker'

async function bootstrap() {
  const sharedBuffer = new SharedArrayBuffer(TOTAL_MEMORY_BYTES)

  const mainGraph = new SceneGraph(sharedBuffer)

  const workerInstance = new BaristaWorker()

  const barista = new BaristaClient(workerInstance)

  const initResult = await barista.init(sharedBuffer)
  console.log('🚀 Engine Started!', initResult)
}

bootstrap()
