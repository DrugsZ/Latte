import { useEffect, useRef } from 'react'
import { Channels } from '@latte-js/bean'
import { editor } from '@latte-js/syrup'

const CanvasArea = () => {
  const containerRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    editor.startup(containerRef.current)

    const nodeService = editor.baristaClient.getService(Channels.Node)
    nodeService?.onCreate(ids => {
      ids.forEach(([id, index]) => {
        editor.graph.registerIdMap(id, index)
      })
    })

    nodeService?.onDelete(ids => {
      ids.forEach(([id, index]) => {
        editor.graph.unregisterIdMap(id, index)
      })
    })

    const transformService = editor.baristaClient.getService(Channels.Transform)

    const sceneService = editor.baristaClient.getService(Channels.Scene)
    sceneService?.onDirty(() => {
      editor.renderer.requestRender()
    })

    // @ts-expect-error test is not defined on window
    window.test = () => editor.renderer.requestRender()

    // @ts-expect-error testRender is not defined on window
    window.testRender = () => {
      transformService
        ?.moveTo(['test:1'], [Math.random() * 400, Math.random() * 400])
        .then(() => {
          editor.renderer.requestRender()
        })
    }

    // const rect = containerRef.current.getBoundingClientRect()
    // const dpr = window.devicePixelRatio || 1

    return () => {
      editor.renderer.dispose()
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
