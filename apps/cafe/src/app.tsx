import { useEffect, useRef, useState } from 'react'
import { type ILatteFile } from '@latte-js/bean'
import { EditorRuntime } from '@latte-js/crema'
import data from './assets/sample.json'

interface CanvasAreaProps {
  readonly onRuntimeChange: (runtime: EditorRuntime | null) => void
}

const CanvasArea = ({ onRuntimeChange }: CanvasAreaProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<EditorRuntime | null>(null)
  const sampleData = data as unknown as ILatteFile

  const startup = async (container: HTMLDivElement) => {
    const runtime = new EditorRuntime()
    runtimeRef.current = runtime
    await runtime.startup(container)
    onRuntimeChange(runtime)
    await runtime.openDocument('latte://sample', sampleData)
  }

  useEffect(() => {
    if (!containerRef.current) return

    startup(containerRef.current).catch(console.error)

    return () => {
      runtimeRef.current?.dispose()
      runtimeRef.current = null
      onRuntimeChange(null)
    }
  }, [onRuntimeChange])

  return <div ref={containerRef} className="canvas-container" />
}

export function App() {
  const [runtime, setRuntime] = useState<EditorRuntime | null>(null)

  return (
    <div className="app-layout">
      <div className="header">
        <button
          type="button"
          data-testid="select-tool"
          onClick={() =>
            runtime?.workbench?.toolService.deactivateCurrentTool()
          }
        >
          Select
        </button>
        <button
          type="button"
          data-testid="rectangle-tool"
          onClick={() =>
            runtime?.workbench?.toolService.activateTool('rectangle-tool')
          }
        >
          Rectangle
        </button>
      </div>

      <div className="main-content">
        <div className="workspace">
          <CanvasArea onRuntimeChange={setRuntime} />
        </div>
      </div>
    </div>
  )
}

export default App
