import React from 'react'
import ReactDOM from 'react-dom/client'

console.log(111)
// import { editor } from '@latte-js/syrup' // 引入核心单例

// // 🔥 核心步骤：引入 Workbench
// // 这会触发 workbench/index.ts 里的代码执行
// // 从而将 RectTool, AlignCommand 等注册到 syrup 中
// import '@latte-js/workbench'

// // 引入 UI 库的样式 (如果有)
// // import '@latte-js/milk/dist/style.css';
// import './index.css'

// import App from './app'

// // 1. 启动编辑器内核
// // 这里会初始化 SceneGraph, CommandRegistry 等
// editor.startup()

// // 2. 挂载 React UI
// ReactDOM.createRoot(document.getElementById('root')!).render(
//   // 关闭 StrictMode 以避免 Canvas/Worker 初始化两次的问题 (开发初期建议)
//   // <React.StrictMode>
//   <App />
//   // </React.StrictMode>,
// )
