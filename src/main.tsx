import { layout, App } from 'Latte/workbench/layout/layoutService'
import 'Latte/assets/css/global.css'

// layout.startup(document.getElementById('root'))

import { createRoot } from 'react-dom/client'

const domNode = document.getElementById('root')
const root = createRoot(domNode)

root.render(<App />)
