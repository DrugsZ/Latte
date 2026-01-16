import { useEffect, useRef } from 'react'
// import { editor } from '@latte-js/syrup'
import { Canvas2DRender, Renderer, Camera } from '@latte-js/art'
import { BaristaClient } from '@latte-js/barista'
import { SceneGraph, TOTAL_MEMORY_BYTES, MAX_NODES } from '@latte-js/espresso'
import { Channels } from '@latte-js/bean'
import BaristaWorker from '@latte-js/barista/worker?worker'
// import { PropertiesPanel, LayerTree, Toolbar } from '@latte-js/milk'

let mainGraph: SceneGraph
let barista: BaristaClient
async function bootstrap() {
  const sharedBuffer = new SharedArrayBuffer(TOTAL_MEMORY_BYTES)
  const allocBuffer = new SharedArrayBuffer(MAX_NODES)

  mainGraph = new SceneGraph(sharedBuffer, allocBuffer)

  const workerInstance = new BaristaWorker()

  barista = new BaristaClient(workerInstance)

  const initResult = await barista.init(sharedBuffer, allocBuffer)
  console.log('🚀 Engine Started!', initResult)
  return initResult
}

// 这是一个胶水组件：负责把非 React 的 Renderer 挂载到 DOM 上
const CanvasArea = () => {
  const containerRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    // 初始化 Camera
    const camera = new Camera(rect.width, rect.height)
    camera.fitBounds(-100, -100, rect.right * 2, rect.bottom * 2, 0)
    console.log('🚀 ~ CanvasArea ~ camera:', camera)
    console.log('🚀 Initial zoom:', camera.getZoom())
    console.log('🚀 Initial position:', camera.getPosition())

    const renderBackend = new Canvas2DRender()
    renderBackend.init(containerRef.current, dpr)
    renderBackend.resize(rect.width, rect.height, dpr)
    let renderer
    bootstrap().then(() => {
      console.log('🚀 Bootstrap completed')
      renderer = new Renderer(mainGraph, renderBackend, camera)

      const nodeService = barista.getService(Channels.Node)
      nodeService?.onCreate(ids => {
        ids.forEach(([id, index]) => {
          mainGraph.registerIdMap(id, index)
        })
      })

      nodeService?.onDelete(ids => {
        ids.forEach(([id, index]) => {
          mainGraph.unregisterIdMap(id, index)
        })
      })

      const transformService = barista.getService(Channels.Transform)

      window.test = () => renderer.renderFrame()

      window.testRender = () => {
        transformService
          ?.moveTo(['test:1'], [Math.random() * 400, Math.random() * 400])
          .then(() => {
            renderer.renderFrame()
          })
      }

      renderer.start()
    })

    return () => {
      renderer.dispose()
    }
  }, [])

  return <canvas ref={containerRef} className="canvas-container" />
}

export function App() {
  return (
    <div className="app-layout">
      {/* <div className="header">
        <Toolbar />
      </div> */}

      <div className="main-content">
        {/* <div className="sidebar-left">
          <LayerTree />
        </div> */}

        <div className="workspace">
          <CanvasArea />
        </div>

        {/* <div className="sidebar-right">
          <PropertiesPanel />
        </div> */}
      </div>
    </div>
  )
}

export default App
