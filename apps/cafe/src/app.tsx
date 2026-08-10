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
  type IDType,
  type ILatteFile,
  type IPaint,
} from '@latte-js/bean'
import {
  CreationToolId,
  SelectionModel,
  SelectionPropertyModel,
  type SelectionPropertyValue,
} from '@latte-js/counter'
import { EditorRuntime } from '@latte-js/crema'
import { NodeCursor } from '@latte-js/espresso'

import data from './assets/sample.json'
import {
  INSPECTOR_PROPERTY_FIELDS,
  createSolidPaint,
  fillColorToHex,
  isInspectorPropertyEditable,
  toPropertyPatch,
  type InspectorPropertyFieldKey,
  type InspectorValueState,
} from './inspectorModel'

interface InspectorField {
  readonly value: string
  readonly state: InspectorValueState
}

interface InspectorSnapshot {
  readonly ids: readonly IDType[]
  readonly name: InspectorField
  readonly fields: Record<InspectorPropertyFieldKey, InspectorField>
}

interface InspectorForm {
  name: string
  x: string
  y: string
  width: string
  height: string
  rotation: string
  opacity: string
  fill: string
  stroke: string
  strokeWeight: string
  cornerRadius: string
  visible: boolean
  locked: boolean
}

const DEFAULT_FILL = '#d9d9d9'
const DEFAULT_STROKE_COLOR = '#000000'
const IDENTITY = [1, 0, 0, 1, 0, 0] as const
const DEFAULT_STROKE = {
  strokeAlign: 'CENTER',
  strokeJoin: 'MITER',
  strokeStyle: 'SOLID',
  dashCap: 'NONE',
} as const

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
      backgrounds: [createSolidPaint('#f5f5f5')],
    },
  ],
})

const readInspectorSnapshot = (
  runtime: EditorRuntime | null,
  selectedIds: readonly IDType[]
): InspectorSnapshot | null => {
  if (!runtime || selectedIds.length === 0 || !runtime.workbench) {
    return null
  }

  const document = runtime.editorHost.activeDocument
  const graph = document?.graph
  if (!document || !graph) {
    return null
  }

  const selectionModel = new SelectionModel(
    runtime.workbench.selectionService,
    graph,
    { documentId: document.id }
  )
  const selectionSnapshot = selectionModel.getSnapshot(
    graph.publicationRevision
  )
  if (!selectionSnapshot || selectionSnapshot.targets.length === 0) {
    return null
  }

  const properties = new SelectionPropertyModel(graph)
  const name =
    selectionSnapshot.targets.length === 1
      ? {
          value: new NodeCursor(graph, selectionSnapshot.targets[0].index).name,
          state: 'uniform' as const,
        }
      : { value: 'Mixed', state: 'mixed' as const }
  const fill = formatPaintProperty(
    properties.read(selectionSnapshot, 'fills') as SelectionPropertyValue<
      IPaint[]
    > | null
  )
  const stroke = formatPaintProperty(
    properties.read(selectionSnapshot, 'strokes') as SelectionPropertyValue<
      IPaint[]
    > | null,
    DEFAULT_STROKE_COLOR
  )

  return {
    ids: selectionSnapshot.targets.map(target => target.id),
    name,
    fields: {
      x: formatNumberProperty(properties.read(selectionSnapshot, 'x')),
      y: formatNumberProperty(properties.read(selectionSnapshot, 'y')),
      width: formatNumberProperty(properties.read(selectionSnapshot, 'width')),
      height: formatNumberProperty(
        properties.read(selectionSnapshot, 'height')
      ),
      rotation: formatNumberProperty(
        properties.read(selectionSnapshot, 'rotation')
      ),
      opacity: formatNumberProperty(
        properties.read(selectionSnapshot, 'opacity')
      ),
      fill,
      stroke,
      strokeWeight: formatNumberProperty(
        properties.read(selectionSnapshot, 'strokeWeight')
      ),
      cornerRadius: formatCornerRadiusProperty(
        properties.read(
          selectionSnapshot,
          'cornerRadius'
        ) as SelectionPropertyValue<number[]> | null
      ),
      visible: formatBooleanProperty(
        properties.read(selectionSnapshot, 'visible')
      ),
      locked: formatBooleanProperty(
        properties.read(selectionSnapshot, 'locked')
      ),
    },
  }
}

const toInspectorForm = (snapshot: InspectorSnapshot): InspectorForm => ({
  name: snapshot.name.value,
  x: snapshot.fields.x.value,
  y: snapshot.fields.y.value,
  width: snapshot.fields.width.value,
  height: snapshot.fields.height.value,
  rotation: snapshot.fields.rotation.value,
  opacity: snapshot.fields.opacity.value,
  fill: snapshot.fields.fill.value,
  stroke: snapshot.fields.stroke.value,
  strokeWeight: snapshot.fields.strokeWeight.value,
  cornerRadius: snapshot.fields.cornerRadius.value,
  visible: snapshot.fields.visible.value === 'true',
  locked: snapshot.fields.locked.value === 'true',
})

const formatNumber = (value: number) => String(Math.round(value * 100) / 100)

const formatNumberProperty = (
  value: SelectionPropertyValue<unknown> | null
): InspectorField => {
  if (!value) {
    return { value: 'Unavailable', state: 'unavailable' }
  }
  switch (value.kind) {
    case 'uniform':
      return { value: formatNumber(Number(value.value)), state: 'uniform' }
    case 'mixed':
      return { value: 'Mixed', state: 'mixed' }
    case 'partial':
      return {
        value:
          value.value === undefined
            ? 'Partial'
            : formatNumber(Number(value.value)),
        state: 'partial',
      }
    case 'unavailable':
      return { value: 'Unavailable', state: 'unavailable' }
  }
}

const formatPaintProperty = (
  value: SelectionPropertyValue<IPaint[]> | null,
  fallback = DEFAULT_FILL
): InspectorField => {
  if (!value) {
    return { value: fallback, state: 'unavailable' }
  }
  if (value.kind !== 'uniform') {
    return { value: fallback, state: value.kind }
  }

  const fill = value.value.find(
    paint => paint.type === FillType.SOLID && paint.visible
  )
  return {
    value:
      fill && fill.type === FillType.SOLID
        ? fillColorToHex(fill.color)
        : fallback,
    state: 'uniform',
  }
}

const formatCornerRadiusProperty = (
  value: SelectionPropertyValue<number[]> | null
): InspectorField => {
  if (!value) {
    return { value: 'Unavailable', state: 'unavailable' }
  }
  if (value.kind !== 'uniform') {
    return {
      value:
        value.kind === 'mixed'
          ? 'Mixed'
          : value.kind === 'partial'
            ? 'Partial'
            : 'Unavailable',
      state: value.kind,
    }
  }
  return {
    value: formatNumber(value.value[0] ?? 0),
    state: 'uniform',
  }
}

const formatBooleanProperty = (
  value: SelectionPropertyValue<unknown> | null
): InspectorField => {
  if (!value) {
    return { value: 'false', state: 'unavailable' }
  }
  if (value.kind !== 'uniform') {
    return { value: 'false', state: value.kind }
  }
  return { value: String(Boolean(value.value)), state: 'uniform' }
}

const fieldTitle = (label: string, field: InspectorField) =>
  field.state === 'uniform' ? label : `${label} (${field.state})`

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
      const value =
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value
      setForm(current => (current ? { ...current, [field]: value } : current))
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
      if (snapshot.ids.length !== 1) {
        return
      }
      await runtime.baristaClient
        .getService(Channels.Node, sessionId)
        .setName(snapshot.ids[0], form.name)
      return
    }

    if (field === 'fill') {
      await commitProperty(field, form.fill)
      return
    }

    await commitProperty(field, form[field])
  }

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape' && snapshot) {
      setForm(toInspectorForm(snapshot))
      event.currentTarget.blur()
    }
  }

  const commitProperty = async (
    field: Exclude<keyof InspectorForm, 'name'>,
    value: string | boolean
  ) => {
    if (!runtime || !snapshot) {
      return
    }

    const sessionId = runtime.editorHost.activeDocument?.id
    if (!sessionId) {
      return
    }

    const patch = toPropertyPatch(field, value)
    if (!patch) {
      setForm(toInspectorForm(snapshot))
      return
    }

    try {
      await runtime.baristaClient
        .getService(Channels.Property, sessionId)
        .setProperties([...snapshot.ids], patch)
    } catch (error) {
      setForm(toInspectorForm(snapshot))
      console.error('[Inspector] Property update failed:', error)
    }
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
            <span>{fieldTitle('Name', snapshot.name)}</span>
            <input
              value={form.name}
              disabled={snapshot.ids.length !== 1}
              onChange={updateField('name')}
              onBlur={() => void commit('name')}
              onKeyDown={handleKey}
            />
          </label>
          {INSPECTOR_PROPERTY_FIELDS.map(field => {
            const snapshotField = snapshot.fields[field.key]
            const disabled = !isInspectorPropertyEditable(
              field,
              snapshotField.state
            )
            return (
              <label key={field.key}>
                <span>{fieldTitle(field.label, snapshotField)}</span>
                {field.input === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(form[field.key])}
                    disabled={disabled}
                    onChange={event => {
                      const checked = event.target.checked
                      setForm(current =>
                        current ? { ...current, [field.key]: checked } : current
                      )
                      void commitProperty(field.key, checked)
                    }}
                  />
                ) : (
                  <input
                    type={field.input === 'color' ? 'color' : undefined}
                    inputMode={field.input === 'number' ? 'decimal' : undefined}
                    min={field.min}
                    max={field.max}
                    value={String(form[field.key])}
                    disabled={disabled}
                    onChange={event => {
                      const value = event.target.value
                      setForm(current =>
                        current ? { ...current, [field.key]: value } : current
                      )
                      if (field.input === 'color') {
                        void commitProperty(field.key, value)
                      }
                    }}
                    onBlur={() => void commit(field.key)}
                    onKeyDown={handleKey}
                  />
                )}
              </label>
            )
          })}
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
