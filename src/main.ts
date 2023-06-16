import Editor from 'Cditor/core/editor'

const initCanvas = ({ width = 800, height = 800 }) => {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('width', String(width))
  canvas.setAttribute('height', String(height))
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  return canvas
}
document.body.style.height = '100vh'
document.body.style.width = '100vw'
const bodyRect = document.body.getBoundingClientRect()
const canvas = initCanvas(bodyRect)
document.body.appendChild(canvas)
const test = new Editor(canvas)
window.test = test
