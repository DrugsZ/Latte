import { useEffect, useRef } from 'react'
import { Channels, NodeType } from '@latte-js/bean'
import { editor } from '@latte-js/syrup'
import { startWorkbench } from '@latte-js/counter'
import data from './assets/sample.json'

const CanvasArea = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  const loadFile = async () => {
    const documentService = editor.baristaClient.getService(Channels.Document)
    if (documentService) {
      documentService.onLoad(ids => {
        ids.forEach((index, id) => {
          editor.graph.registerIdMap(id, index)
        })
        // resetActivePage()
      })
      // const response = await fetch('/sample.latte')
      // const data = await response.json()
      await documentService.load(data)
    }
  }

  const startup = async (container: HTMLDivElement) => {
    await editor.startup(container)

    const workbench = await startWorkbench(editor)

    await loadFile()

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
    // @ts-expect-error test is not defined on window
    window.testAdd = async () => {
      const ids = workbench.selectionService.indices
      if (ids.length > 0) {
        console.log(ids)
        transformService
          ?.moveTo(ids, [Math.random() * 800, Math.random() * 800])
          .then(() => {
            editor.renderer.requestRender()
          })
      }
    }

    let animationId: number | null = null
    // @ts-expect-error testRender is not defined on window
    window.testRender = () => {
      // 如果动画已经在运行，停止它
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
      }

      let position = 0
      let direction = 1

      const animate = () => {
        position += direction * 2
        if (position >= 400 || position <= 0) {
          direction *= -1
        }
        transformService?.moveTo(['test:1'], [position, 200])
        animationId = requestAnimationFrame(animate)
      }

      animate()
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    startup(containerRef.current)

    return () => {
      editor.renderer.dispose()
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
