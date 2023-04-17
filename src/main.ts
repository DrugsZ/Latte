import Editor from 'Cditor/core/editor'

const initCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('width', '1500')
  canvas.setAttribute('height', '1000')
  canvas.style.width = '1500px'
  canvas.style.height = '1000px'
  return canvas
}

const canvas = initCanvas()
document.body.appendChild(canvas)
const test = new Editor(canvas)
window.test = test
