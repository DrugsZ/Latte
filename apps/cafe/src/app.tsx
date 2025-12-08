import { useEffect, useRef } from 'react'
import { editor } from '@latte-js/syrup'
import { Renderer } from '@latte-js/art'
import { PropertiesPanel, LayerTree, Toolbar } from '@latte-js/milk'

// 这是一个胶水组件：负责把非 React 的 Renderer 挂载到 DOM 上
const CanvasArea = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 初始化渲染器
    // editor.graph 是从 syrup 单例里拿到的
    const renderer = new Renderer(containerRef.current, editor.graph)

    // 启动渲染循环
    renderer.start()

    // 绑定给 editor (方便 InputService 访问)
    editor.attachRenderer(renderer)

    return () => {
      renderer.dispose()
    }
  }, [])

  return <div ref={containerRef} className="canvas-container" />
}

function App() {
  return (
    <div className="app-layout">
      {/* 顶部工具栏 */}
      <div className="header">
        <Toolbar />
      </div>

      <div className="main-content">
        {/* 左侧图层树 */}
        <div className="sidebar-left">
          <LayerTree />
        </div>

        {/* 中间画布 */}
        <div className="workspace">
          <CanvasArea />
        </div>

        {/* 右侧属性面板 */}
        <div className="sidebar-right">
          <PropertiesPanel />
        </div>
      </div>
    </div>
  )
}

export default App
