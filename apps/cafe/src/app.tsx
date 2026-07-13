import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import {
  BlendModeType,
  Channels,
  FillType,
  type FillColor,
  type IDType,
  type ILatteFile,
  type IPaint,
} from '@latte-js/bean'
import { CreationToolId } from '@latte-js/counter'
import { EditorRuntime } from '@latte-js/crema'
import { NodeCursor, NULL_INDEX } from '@latte-js/espresso'

import data from './assets/sample.json'

interface InspectorSnapshot {
  readonly id: IDType
  readonly name: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fill: string
}

interface InspectorForm {
  name: string
  x: string
  y: string
  width: string
  height: string
  fill: string
}

const DEFAULT_FILL = '#d9d9d9'
const IDENTITY = [1, 0, 0, 1, 0, 0] as const
const DEFAULT_STROKE = {
  strokeAlign: 'CENTER',
  strokeJoin: 'MITER',
  strokeStyle: 'SOLID',
  dashCap: 'NONE',
} as const

const createSolidFill = (hex: string): IPaint => ({
  type: FillType.SOLID,
  visible: true,
  opacity: 1,
  blendMode: BlendModeType.NORMAL,
  color: hexToFillColor(hex),
})

const fillColorToHex = (color: FillColor) => {
  const toByte = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${toByte(color.r)}${toByte(color.g)}${toByte(color.b)}`
}

const hexToFillColor = (hex: string): FillColor => {
  const normalized = hex.replace('#', '')
  const read = (offset: number) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255
  return {
    r: read(0),
    g: read(2),
    b: read(4),
    a: 1,
  }
}

const createBlankDocumentData = (): ILatteFile => ({
  elements: [
    {
      guid: '0:0',
      type: 'DOCUMENT',
      name: 'Document',
      visible: true,
      opacity: 1,
      blendMode: BlendModeType.NORMAL,
      transform: [...IDENTITY],
      size: { x: 0, y: 0 },
      strokeWeight: 0,
      ...DEFAULT_STROKE,
      locked: false,
    },
    {
      guid: '0:1',
      parentIndex: { guid: '0:0', position: '!' },
      type: 'CANVAS',
      name: 'Page 1',
      visible: true,
      opacity: 1,
      blendMode: BlendModeType.NORMAL,
      transform: [...IDENTITY],
      size: { x: 0, y: 0 },
      strokeWeight: 0,
      ...DEFAULT_STROKE,
      locked: false,
      backgrounds: [createSolidFill('#f5f5f5')],
    },
  ],
})

const readInspectorSnapshot = (
  runtime: EditorRuntime | null,
  selectedIds: readonly IDType[]
): InspectorSnapshot | null => {
  if (!runtime || selectedIds.length !== 1) {
    return null
  }

  const graph = runtime.editorHost.activeDocument?.graph
  if (!graph) {
    return null
  }

  const id = selectedIds[0]
  const index = graph.getIndex(id)
  if (index === NULL_INDEX) {
    return null
  }

  const cursor = new NodeCursor(graph, index)
  const fill = cursor.fills.find(
    paint => paint.type === FillType.SOLID && paint.visible
  )

  return {
    id,
    name: cursor.name,
    x: cursor.x,
    y: cursor.y,
    width: cursor.width,
    height: cursor.height,
    fill:
      fill && fill.type === FillType.SOLID
        ? fillColorToHex(fill.color)
        : DEFAULT_FILL,
  }
}

const toInspectorForm = (snapshot: InspectorSnapshot): InspectorForm => ({
  name: snapshot.name,
  x: String(Math.round(snapshot.x * 100) / 100),
  y: String(Math.round(snapshot.y * 100) / 100),
  width: String(Math.round(snapshot.width * 100) / 100),
  height: String(Math.round(snapshot.height * 100) / 100),
  fill: snapshot.fill,
})

const CanvasArea = (props: {
  readonly onReady: (runtime: EditorRuntime) => void
  readonly onDispose: () => void
}) => {
  const { onReady, onDispose } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<EditorRuntime | null>(null)
  const sampleData = data as unknown as ILatteFile

  const startup = useCallback(
    async (container: HTMLDivElement) => {
      const runtime = new EditorRuntime()
      runtimeRef.current = runtime
      await runtime.startup(container)
      await runtime.openDocument('latte://sample', sampleData)
      onReady(runtime)
    },
    [onReady, sampleData]
  )

  useEffect(() => {
    if (!containerRef.current) return

    startup(containerRef.current).catch(console.error)

    return () => {
      runtimeRef.current?.dispose()
      runtimeRef.current = null
      onDispose()
    }
  }, [onDispose, startup])

  return <div ref={containerRef} className="canvas-container" />
}

const Inspector = (props: {
  readonly runtime: EditorRuntime | null
  readonly selectedIds: readonly IDType[]
  readonly revision: number
}) => {
  const { runtime, selectedIds, revision } = props
  const snapshot = useMemo(
    () => readInspectorSnapshot(runtime, selectedIds),
    [runtime, selectedIds, revision]
  )
  const [form, setForm] = useState<InspectorForm | null>(null)

  useEffect(() => {
    setForm(snapshot ? toInspectorForm(snapshot) : null)
  }, [snapshot])

  const updateField = (field: keyof InspectorForm) => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm(current =>
        current ? { ...current, [field]: event.target.value } : current
      )
    }
  }

  const commit = async (field: keyof InspectorForm) => {
    if (!runtime || !snapshot || !form) {
      return
    }

    const sessionId = runtime.editorHost.activeDocument?.id
    if (!sessionId) {
      return
    }

    if (field === 'name') {
      await runtime.baristaClient
        .getService(Channels.Node, sessionId)
        .setName(snapshot.id, form.name)
      return
    }

    if (field === 'fill') {
      await commitFill(form.fill)
      return
    }

    const value = Number(form[field])
    if (!Number.isFinite(value)) {
      setForm(toInspectorForm(snapshot))
      return
    }

    const transform = runtime.baristaClient.getService(
      Channels.Transform,
      sessionId
    )
    if (field === 'x') {
      await transform.moveTo([snapshot.id], [value, snapshot.y])
    } else if (field === 'y') {
      await transform.moveTo([snapshot.id], [snapshot.x, value])
    } else if (field === 'width') {
      await transform.resize([snapshot.id], Math.max(0, value), snapshot.height)
    } else if (field === 'height') {
      await transform.resize([snapshot.id], snapshot.width, Math.max(0, value))
    }
  }

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape' && snapshot) {
      setForm(toInspectorForm(snapshot))
      event.currentTarget.blur()
    }
  }

  const commitFill = async (fill: string) => {
    if (!runtime || !snapshot) {
      return
    }

    const sessionId = runtime.editorHost.activeDocument?.id
    if (!sessionId) {
      return
    }

    await runtime.baristaClient
      .getService(Channels.Style, sessionId)
      .setFill(snapshot.id, createSolidFill(fill))
  }

  const selectionState =
    selectedIds.length === 0
      ? 'No selection'
      : selectedIds.length > 1
        ? 'Mixed selection'
        : null

  return (
    <aside className="inspector">
      <div className="panel-title">Inspector</div>
      {!snapshot || !form ? (
        <div className="empty-state">{selectionState}</div>
      ) : (
        <div className="property-grid">
          <label>
            <span>Name</span>
            <input
              value={form.name}
              onChange={updateField('name')}
              onBlur={() => void commit('name')}
              onKeyDown={handleKey}
            />
          </label>
          <label>
            <span>X</span>
            <input
              type="number"
              value={form.x}
              onChange={updateField('x')}
              onBlur={() => void commit('x')}
              onKeyDown={handleKey}
            />
          </label>
          <label>
            <span>Y</span>
            <input
              type="number"
              value={form.y}
              onChange={updateField('y')}
              onBlur={() => void commit('y')}
              onKeyDown={handleKey}
            />
          </label>
          <label>
            <span>W</span>
            <input
              type="number"
              min="0"
              value={form.width}
              onChange={updateField('width')}
              onBlur={() => void commit('width')}
              onKeyDown={handleKey}
            />
          </label>
          <label>
            <span>H</span>
            <input
              type="number"
              min="0"
              value={form.height}
              onChange={updateField('height')}
              onBlur={() => void commit('height')}
              onKeyDown={handleKey}
            />
          </label>
          <label>
            <span>Fill</span>
            <input
              type="color"
              value={form.fill}
              onChange={event => {
                const fill = event.target.value
                setForm(current => (current ? { ...current, fill } : current))
                void commitFill(fill)
              }}
            />
          </label>
        </div>
      )}
    </aside>
  )
}

export function App() {
  const [runtime, setRuntime] = useState<EditorRuntime | null>(null)
  const [selectedIds, setSelectedIds] = useState<IDType[]>([])
  const [revision, setRevision] = useState(0)
  const [savedData, setSavedData] = useState<ILatteFile | null>(null)
  const [activeTool, setActiveTool] = useState<'select' | 'rectangle'>('select')

  const handleCanvasDispose = useCallback(() => {
    setRuntime(null)
    setSelectedIds([])
  }, [])

  useEffect(() => {
    if (!runtime?.workbench) {
      return
    }

    setSelectedIds(runtime.workbench.selectionService.ids)
    const selectionDisposable =
      runtime.workbench.selectionService.onSelectChange(ids => {
        setSelectedIds(ids)
        setRevision(value => value + 1)
      })
    const dirtyDisposable = runtime.projection.onDidMarkDirty(() => {
      setRevision(value => value + 1)
    })

    return () => {
      selectionDisposable.dispose()
      dirtyDisposable.dispose()
    }
  }, [runtime])

  const activateSelect = () => {
    runtime?.workbench?.toolService.deactivateCurrentTool()
    setActiveTool('select')
  }

  const activateRectangle = () => {
    runtime?.workbench?.toolService.activateTool(CreationToolId.Rectangle)
    setActiveTool('rectangle')
  }

  const getActiveDocumentService = () => {
    const sessionId = runtime?.editorHost.activeDocument?.id
    if (!runtime || !sessionId) {
      return null
    }
    return runtime.baristaClient.getService(Channels.Document, sessionId)
  }

  const runUndoRedo = async (method: 'undo' | 'redo') => {
    const sessionId = runtime?.editorHost.activeDocument?.id
    if (!runtime || !sessionId) {
      return
    }
    await runtime.baristaClient
      .getService(Channels.UndoRedo, sessionId)
      [method]()
  }

  const createDocument = async () => {
    if (!runtime) {
      return
    }
    await runtime.createDocument(createBlankDocumentData())
    runtime.workbench?.selectionService.clear()
    setSelectedIds([])
    setSavedData(null)
    activateSelect()
  }

  const saveDocument = async () => {
    const documentService = getActiveDocumentService()
    if (!documentService) {
      return
    }
    setSavedData(await documentService.save())
  }

  const reloadSavedDocument = async () => {
    const doc = runtime?.editorHost.activeDocument
    if (!runtime || !doc || !savedData) {
      return
    }
    runtime.workbench?.selectionService.clear()
    await runtime.loadDocument(doc.id, savedData)
    setSelectedIds([])
  }

  return (
    <div className="app-layout">
      <header className="toolbar">
        <button onClick={() => void createDocument()}>New</button>
        <button
          className={activeTool === 'select' ? 'active' : ''}
          onClick={activateSelect}
        >
          Select
        </button>
        <button
          className={activeTool === 'rectangle' ? 'active' : ''}
          onClick={activateRectangle}
        >
          Rect
        </button>
        <span className="toolbar-divider" />
        <button onClick={() => void runUndoRedo('undo')}>Undo</button>
        <button onClick={() => void runUndoRedo('redo')}>Redo</button>
        <span className="toolbar-divider" />
        <button onClick={() => void saveDocument()}>Save</button>
        <button
          disabled={!savedData}
          onClick={() => void reloadSavedDocument()}
        >
          Reload
        </button>
      </header>

      <div className="main-content">
        <div className="workspace">
          <CanvasArea onReady={setRuntime} onDispose={handleCanvasDispose} />
        </div>

        <Inspector
          runtime={runtime}
          selectedIds={selectedIds}
          revision={revision}
        />
      </div>
    </div>
  )
}

export default App
