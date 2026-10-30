import { BlendModeType, FillType, type ILatteFile } from '@latte-js/bean'
import { DEFAULT_HEAP_SIZE, MAX_NODES } from '@latte-js/espresso'

const SUPPORTED_TYPES = new Set([
  'DOCUMENT',
  'CANVAS',
  'FRAME',
  'GROUP',
  'RECTANGLE',
  'ELLIPSE',
])
const CONTAINERS = new Set(['DOCUMENT', 'CANVAS', 'FRAME', 'GROUP'])
const STROKE_ENUMS: Record<string, readonly string[]> = {
  strokeAlign: ['INSIDE', 'CENTER', 'OUTSIDE'],
  strokeJoin: ['MITER', 'BEVEL', 'ROUND'],
  strokeStyle: ['SOLID', 'DASH'],
  dashCap: ['NONE', 'SQUARE', 'ROUND'],
  strokeCap: ['NONE', 'SQUARE', 'ROUND'],
}

const fail = (path: string, message: string): never => {
  throw new Error(`[DocumentImport] ${path}: ${message}`)
}
const object = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'expected an object')
  }
  return value as Record<string, unknown>
}
const number = (
  value: unknown,
  path: string,
  min = -Infinity,
  max = Infinity
) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isFinite(Math.fround(value)) ||
    value < min ||
    value > max
  ) {
    fail(path, `expected a finite number in range ${min}..${max}`)
  }
}
const id = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !/^[^:]+:.+$/.test(value)) {
    fail(path, 'expected a nonempty namespace:id string')
  }
  return value as string
}
const matrix = (value: unknown, path: string) => {
  if (!Array.isArray(value) || value.length !== 6) {
    fail(path, 'expected a six-number affine matrix')
  }
  ;(value as unknown[]).forEach((entry, i) => number(entry, `${path}[${i}]`))
}
const color = (value: unknown, path: string) => {
  const channels = object(value, path)
  for (const key of ['r', 'g', 'b', 'a']) {
    number(channels[key], `${path}.${key}`, 0, 1)
  }
}
const blend = (value: unknown, path: string) => {
  if (
    value !== undefined &&
    !(
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= BlendModeType.NORMAL &&
      value <= BlendModeType.LUMINOSITY
    ) &&
    !(
      typeof value === 'string' &&
      (value === 'PASS_THROUGH' ||
        typeof BlendModeType[value as keyof typeof BlendModeType] === 'number')
    )
  ) {
    fail(path, 'unsupported blend mode')
  }
}
const paints = (value: unknown, path: string) => {
  if (!Array.isArray(value)) fail(path, 'expected an array of paints')
  ;(value as unknown[]).forEach((entry, i) => {
    const at = `${path}[${i}]`
    const paint = object(entry, at)
    if (typeof paint.visible !== 'boolean')
      fail(`${at}.visible`, 'expected a boolean')
    number(paint.opacity, `${at}.opacity`, 0, 1)
    blend(paint.blendMode, `${at}.blendMode`)
    if (paint.blendMode === 'PASS_THROUGH') {
      fail(
        `${at}.blendMode`,
        'PASS_THROUGH is a container setting, not a paint mode'
      )
    }
    if (paint.type === FillType.SOLID) {
      color(paint.color, `${at}.color`)
    } else if (
      typeof paint.type === 'string' &&
      paint.type.startsWith('GRADIENT_') &&
      Object.values(FillType).includes(paint.type as FillType)
    ) {
      if (!Array.isArray(paint.stops) || paint.stops.length < 2) {
        fail(`${at}.stops`, 'expected at least two gradient stops')
      }
      ;(paint.stops as unknown[]).forEach((entry, j) => {
        const stop = object(entry, `${at}.stops[${j}]`)
        number(stop.position, `${at}.stops[${j}].position`, 0, 1)
        color(stop.color, `${at}.stops[${j}].color`)
      })
      if (paint.transform !== undefined)
        matrix(paint.transform, `${at}.transform`)
    } else {
      // The file format has image paints, but the demo has no asset import /
      // persistence contract yet. Fail clearly instead of accepting lost data.
      fail(`${at}.type`, 'only solid and gradient paints can be imported')
    }
  })
}

/** Validates untrusted file input before any worker/model mutation. */
export function assertLatteFile(value: unknown): asserts value is ILatteFile {
  const file = object(value, 'document')
  if (!Array.isArray(file.elements) || file.elements.length < 2) {
    fail('elements', 'expected a document root and at least one canvas')
  }
  const elements = file.elements as unknown[]
  if (elements.length > MAX_NODES)
    fail('elements', `capacity is ${MAX_NODES} nodes`)
  const byId = new Map<string, Record<string, unknown>>()
  const encoder = new TextEncoder()
  let heapBytes = 4
  let rootId: string | undefined
  let canvasCount = 0

  for (const [index, entry] of elements.entries()) {
    const at = `elements[${index}]`
    const node = object(entry, at)
    const guid = id(node.guid, `${at}.guid`)
    if (byId.has(guid)) fail(`${at}.guid`, `duplicate id ${guid}`)
    byId.set(guid, node)
    if (typeof node.type !== 'string' || !SUPPORTED_TYPES.has(node.type)) {
      fail(`${at}.type`, 'unsupported node type')
    }
    if (node.type === 'DOCUMENT') {
      if (rootId !== undefined) fail(at, 'only one DOCUMENT root is allowed')
      if (node.parentIndex !== undefined)
        fail(at, 'DOCUMENT cannot have a parent')
      rootId = guid
    } else {
      const parent = object(node.parentIndex, `${at}.parentIndex`)
      id(parent.guid, `${at}.parentIndex.guid`)
      if (typeof parent.position !== 'string' || parent.position.length === 0) {
        fail(
          `${at}.parentIndex.position`,
          'expected a nonempty sibling position string'
        )
      }
      if (node.type === 'CANVAS') canvasCount++
    }
    if (node.transform !== undefined) matrix(node.transform, `${at}.transform`)
    if (node.size !== undefined) {
      const size = object(node.size, `${at}.size`)
      number(size.x, `${at}.size.x`, 0)
      number(size.y, `${at}.size.y`, 0)
    }
    if (node.name !== undefined && typeof node.name !== 'string')
      fail(`${at}.name`, 'expected a string')
    for (const key of ['visible', 'locked']) {
      if (node[key] !== undefined && typeof node[key] !== 'boolean')
        fail(`${at}.${key}`, 'expected a boolean')
    }
    if (node.opacity !== undefined) number(node.opacity, `${at}.opacity`, 0, 1)
    blend(node.blendMode, `${at}.blendMode`)
    if (
      node.blendMode !== undefined &&
      node.blendMode !== BlendModeType.NORMAL &&
      node.blendMode !== 'NORMAL' &&
      node.blendMode !== 'PASS_THROUGH'
    ) {
      fail(
        `${at}.blendMode`,
        'layer blending is not supported by the current data kernel'
      )
    }
    if (node.cornerSmoothing !== undefined && node.cornerSmoothing !== 0) {
      fail(`${at}.cornerSmoothing`, 'corner smoothing is not supported')
    }
    for (const key of [
      'strokeWeight',
      'cornerRadius',
      'topLeftRadius',
      'topRightRadius',
      'bottomLeftRadius',
      'bottomRightRadius',
      'strokeTopWeight',
      'strokeBottomWeight',
      'strokeLeftWeight',
      'strokeRightWeight',
    ]) {
      if (node[key] !== undefined) number(node[key], `${at}.${key}`, 0)
    }
    for (const key of [
      'strokeTopWeight',
      'strokeBottomWeight',
      'strokeLeftWeight',
      'strokeRightWeight',
    ]) {
      if (node[key] !== undefined && node[key] !== (node.strokeWeight ?? 0)) {
        fail(`${at}.${key}`, 'independent edge stroke widths are not supported')
      }
    }
    for (const [key, allowed] of Object.entries(STROKE_ENUMS)) {
      if (node[key] !== undefined && !allowed.includes(node[key] as string))
        fail(`${at}.${key}`, 'unsupported stroke value')
    }
    for (const key of ['fillPaints', 'strokePaints', 'backgrounds']) {
      if (node[key] !== undefined) paints(node[key], `${at}.${key}`)
    }
    // The worker's shared heap is fixed. Account for the loader's actual blob
    // allocations (four-byte header and alignment) before replacing a document.
    for (const key of ['name', 'fillPaints', 'strokePaints', 'backgrounds']) {
      if (node[key] === undefined) continue
      const text =
        key === 'name' ? (node[key] as string) : JSON.stringify(node[key])
      heapBytes += Math.ceil((4 + encoder.encode(text).length) / 4) * 4
      if (heapBytes > DEFAULT_HEAP_SIZE)
        fail('elements', 'document exceeds shared blob heap capacity')
    }
  }
  if (rootId === undefined || canvasCount === 0)
    fail('elements', 'expected one DOCUMENT and at least one CANVAS')

  for (const [guid, node] of byId) {
    if (guid === rootId) continue
    const parentId = (node.parentIndex as Record<string, unknown>)
      .guid as string
    const parent = byId.get(parentId)
    if (!parent) fail(guid, `missing parent ${parentId}`)
    if (!CONTAINERS.has(parent!.type as string))
      fail(guid, 'parent must be a container')
    if (node.type === 'CANVAS' ? parentId !== rootId : parentId === rootId) {
      fail(
        guid,
        'CANVAS must be directly under DOCUMENT; drawing nodes must be under a canvas'
      )
    }
  }
  const connected = new Set<string>([rootId as string])
  for (const guid of byId.keys()) {
    const path = new Set<string>()
    let current = guid
    while (!connected.has(current)) {
      if (path.has(current)) fail(guid, 'parent cycle detected')
      path.add(current)
      const node = byId.get(current)!
      current = (node.parentIndex as Record<string, unknown>).guid as string
    }
    for (const visited of path) connected.add(visited)
  }
}

export function validateDocument(value: unknown): ILatteFile {
  assertLatteFile(value)
  return value
}
