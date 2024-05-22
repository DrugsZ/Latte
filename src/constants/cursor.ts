const ADD_OBJECT_CURSOR = `<image xmlns="http://www.w3.org/2000/svg" id="image0_214_2" width="32" height="32" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAHFJREFUWEdjZBhgwDjA9jOMOmA0BIZ8CDRAcxGMJjlTURoC+6E2OpJsM1TDqANGQ2A0BAiFACh/2+PJYg5QuQN41BwEyuEsJwa9AwiVL6MF0WgIjIbAgIfAgDdICJUTBOUJlYQEDaBUwagDRkNgwEMAAC6uFiHehbuXAAAAAElFTkSuQmCC"/>`

// const ROTATE_CORNER_CURSOR = `<path d="M22.4789 9.45728L25.9935 12.9942L22.4789 16.5283V14.1032C18.126 14.1502 14.6071 17.6737 14.5675 22.0283H17.05L13.513 25.543L9.97889 22.0283H12.5674C12.6071 16.5691 17.0214 12.1503 22.4789 12.1031L22.4789 9.45728Z" fill="black"/><path fill-rule="evenodd" clip-rule="evenodd" d="M21.4789 7.03223L27.4035 12.9945L21.4789 18.9521V15.1868C18.4798 15.6549 16.1113 18.0273 15.649 21.0284H19.475L13.5128 26.953L7.55519 21.0284H11.6189C12.1243 15.8155 16.2679 11.6677 21.4789 11.1559L21.4789 7.03223ZM22.4789 12.1031C17.0214 12.1503 12.6071 16.5691 12.5674 22.0284H9.97889L13.513 25.543L17.05 22.0284H14.5675C14.5705 21.6896 14.5947 21.3558 14.6386 21.0284C15.1157 17.4741 17.9266 14.6592 21.4789 14.1761C21.8063 14.1316 22.1401 14.1069 22.4789 14.1032V16.5284L25.9935 12.9942L22.4789 9.45729L22.4789 12.1031Z" fill="white"/>`

const ROTATE_CORNER_CURSOR = `<image xmlns="http://www.w3.org/2000/svg" id="image0_214_2" width="32" height="32" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAA7BJREFUWEftVl1MUmEYfk5/StQqKoVwduklicKQKZhTu2j9uJZza14fdbMfsi11a5Xk5gpbNwqXaX/D5rqJtMydiVviucB50ZpXEYQVHstypf2d9rrDxgo4iLRu+jYGHD7e93mf93mf72Pwjxfzj/PjP4D/DGSKgXUA1gMrmvoJ4AcAMRWBZwLABgDZgiBcUKlU56anp4/odLonAJYlMElxrBUAJd8cDAYv5+XlnWpqaprt6enReL3e4xaLxQNgSQ7EWgCsJA8EAh35+fknjUbjF57nFSzLvnM6nTmpglgLAMXs7KxdrVbbjEYjVUqL4ol6vf4jgZiamjpaWFj4CMDXRH1IFwD9TwkgNxKJ3B8dHSXaFT6fL2tycjJrYGDgTUFBwUOdTncRwJzUirgY0gVAwRQAdgPYGwwGnR0dHWp66HK5VOPj4/fKysquAQgBeP83GKBcpIHtALRer/d8c3PzYdJBbW0tV1lZeQPAawARAJ+lscw4A8TeFgB7RFF8wTAMRFGEz+e7ZTKZ7ADeAviULHlUNKn4Rbw9ZDzbZmZm7A6H45jL5cohAAzDlAAIABCSUR8NmK4GyPkUw8PDh6qrq+9S9SzLztXX1z8uLS2l6ol+ql7WDZMBSGSv9Dyb47iDVqvV3djYGBFFkXE6nbsYhikD8FLqPTmh7EoEIJ69PpX6uYnjuAOUvKGh4V2U+omJidslJSWdAMIAPso5YLIWrDhcKBS6pNVqT0ft1ePxnFAqld+Ki4vPDg0Nabu6unaS8bS0tCxoNBrOYrFcB/AKwLx0DshWH0+Ef9hrUVHRYm9v726O4yAIQogSS5Y7R7SPjY25rVYrjR1VTqZDY0cnYkortgX0WREOh+0ajeYM2SvP89kGg2GZ5/ksimYwGJb0ev1iRUXFD7PZLPT3999ua2sblUaOVE/Jv6eUOca7o/tJXFsHBweP1NTU3GRZVvD7/VtsNhupGXV1dbvoPRQKPe/r67vT3t7+TKKbql6QM5xUzgICQMaidjgch20221WWZef9fr+S/H1kZORBVVVVP4APMS8SG1VNiqdLyKrX7y0gqneQu3V2dh5obW294na73+bm5o6Vl5c7JXOhahcBfJGMhiiXnfdUGKA9KzMOQAUgp7u7e7/ZbN5nMpl6pNmmg4Uq/raaa1cyWuL5QBTENqkl9J2SRvu8KpHJ9SSREVHSTQA2SpcMqpguFWn1ebUMxJpUFCD1OO0+pwtAjr2M/J7uaZiR5PGsOGOBUw30C7AWYjCXaOrKAAAAAElFTkSuQmCC"/>`

const RESIZE_CURSOR = `<image xmlns="http://www.w3.org/2000/svg" id="image0_214_2" width="32" height="32" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAlJJREFUWEftlU2IEnEYxh/b3dSKIj8QySSQgpYVmpMQzOxF8KBEdFhi0MNcBC+dOmlsEKEdFmTB8BB48CAdOog4s8ImJskePEmHDkWQsGoyFkGWfTrxlxGWxZmd3T24hxmYwzDvn/f3PvO8zxgw58sw5/7QAXQFdAV0BU68AosAFvr9/qrD4XgF4C+AsUp6LgBYlOvrcv0/tbRVU2AJwJnRaCSYTKabrVbrNkVR2wB+KkAQWLMoius2m+3+YDDYsNvtjwD8AKAIoQRAmp8bDodb4XB4SZIkQ7FYpKrV6l2/3/8SwB8A0p7JTgEwttvthNvtvme1Wt9nMpkxwzBbLpdrXQ1iFgCZhDSvsCxrLJVKN/L5/MdIJHJF648rFAq95Xl+uVAovGMYRlCDmAVg7vV6j2u1Wohl2WtamyrVSZKEZrN5x+fzCQB+7a/bD0CezwJwiKL4guM4Y7lcvp7L5Tocx13SChMMBj8IguAhynm93hpFUQ8BDACMDgIg780ArAAudzqdZ9FodOIBnuevxuPxJ6lU6o3s7r0eIOCnK5XKWiAQuGWxWHbT6fTY4/Hs0DS9AWAXwFctChCAiQcA2AE4u93uU6fTuZJMJh8kEonXAL4B+D3DhCYAF+r1epRhmLVGo/GcpulNAJ8AfFYyouoWyEpczGazvlgs1pCnIAAztwDAeQDT+h258ZfDbsH0M01yQL6JKmT/vx+UA7KHyFmiEsmAI+XAFGKShADInpMw0ZSEcj1JTFJ/5CTUavpj1Z34n9GxptNyWFdAV0BXYO4K/Ada+ckhCh3WlQAAAABJRU5ErkJggg=="/>`

function getCursorCss(
  svg: string,
  r: number,
  tr: number,
  f: boolean,
  color: string,
  hotspotX = 16,
  hotspotY = 16
) {
  const a = (-tr - r) * (Math.PI / 180)
  const s = Math.sin(a)
  const c = Math.cos(a)
  const dx = 1 * c - 1 * s
  const dy = 1 * s + 1 * c

  return `url("data:image/svg+xml,<svg height='32' width='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: ${color};'><defs><filter id='shadow' y='-40%' x='-40%' width='180px' height='180%' color-interpolation-filters='sRGB'><feDropShadow dx='${dx}' dy='${dy}' stdDeviation='1.2' flood-opacity='.5'/></filter></defs><g fill='none' transform='rotate(${
    r + tr
  } 16 16)${
    f ? ` scale(-1,-1) translate(0, -32)` : ''
  }' filter='url(%23shadow)'>${svg.replaceAll(
    `"`,
    `'`
  )}</g></svg>") ${hotspotX} ${hotspotY}, pointer`
}

export const CURSORS = {
  default: () =>
    getComputedStyle(document.documentElement).getPropertyValue(
      '--cursor-default'
    ),
  readonly: () =>
    getComputedStyle(document.documentElement).getPropertyValue(
      '--cursor-readonly'
    ),
  add: (r, f, c) => getCursorCss(ADD_OBJECT_CURSOR, r, 0, f, c),
  resize: (r, f, c) => getCursorCss(RESIZE_CURSOR, r, 0, f, c, 15, 15),
  rotate: (r, f, c) => getCursorCss(ROTATE_CORNER_CURSOR, r, 0, f, c),
}
