import { useEffect, useRef } from 'react'
import { type ILatteFile } from '@latte-js/bean'
import { EditorRuntime } from '@latte-js/crema'
import data from './assets/sample.json'

const CanvasArea = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<EditorRuntime | null>(null)
  const sampleData = data as unknown as ILatteFile

  const startup = async (container: HTMLDivElement) => {
    const runtime = new EditorRuntime()
    runtimeRef.current = runtime
    await runtime.startup(container)
    await runtime.loadDocument(sampleData)
  }

  useEffect(() => {
    if (!containerRef.current) return

    startup(containerRef.current).catch(console.error)

    return () => {
      runtimeRef.current?.dispose()
      runtimeRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="canvas-container" />
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
