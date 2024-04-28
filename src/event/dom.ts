export const EventType = {
  // Mouse
  CLICK: 'click',
  AUXCLICK: 'auxclick',
  DBLCLICK: 'dblclick',
  MOUSE_UP: 'mouseup',
  MOUSE_DOWN: 'mousedown',
  MOUSE_OVER: 'mouseover',
  MOUSE_MOVE: 'mousemove',
  MOUSE_OUT: 'mouseout',
  MOUSE_ENTER: 'mouseenter',
  MOUSE_LEAVE: 'mouseleave',
  MOUSE_WHEEL: 'wheel',
  POINTER_UP: 'pointerup',
  POINTER_DOWN: 'pointerdown',
  POINTER_MOVE: 'pointermove',
  POINTER_LEAVE: 'pointerleave',
  CONTEXT_MENU: 'contextmenu',
  WHEEL: 'wheel',

  // Keyboard
  KEY_DOWN: 'keydown',
  KEY_PRESS: 'keypress',
  KEY_UP: 'keyup',
} as const
