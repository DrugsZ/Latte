import { App } from 'workbench/layout/layoutService'
import 'Latte/assets/css/global.css'
import 'workbench//components/root.css'

// layout.startup(document.getElementById('root'))

import { createRoot } from 'react-dom/client'

const domNode = document.getElementById('root')
const root = createRoot(domNode)

root.render(<App />)
