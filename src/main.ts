import Editor from 'Cditor/core/editor'

const initCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('width', '800')
  canvas.setAttribute('height', '800')
  canvas.style.width = '800px'
  canvas.style.height = '800px'
  return canvas
}

const canvas = initCanvas()
document.body.appendChild(canvas)
const test = new Editor(canvas)
window.test = test
