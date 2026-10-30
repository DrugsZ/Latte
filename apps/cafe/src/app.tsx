import { useEffect, useRef, useState } from 'react'
import type { ILatteFile } from '@latte-js/bean'
import {
  EditorRuntime,
  EditorSessionController,
  validateDocument,
  type EditableProperty,
  type SelectedNodeProperties,
} from '@latte-js/crema'

import { PropertyPanel } from './propertyPanel'
import data from './assets/sample.json'

const sampleData = data as unknown as ILatteFile
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

function CanvasArea({
  documentData,
  onRuntimeChange,
  onLoadingChange,
  onError,
  onStatusChange,
}: {
  documentData: ILatteFile
  onRuntimeChange: (runtime: EditorRuntime | null) => void
  onLoadingChange: (loading: boolean) => void
  onError: (message: string) => void
  onStatusChange: (message: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<EditorRuntime | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    const staging = document.createElement('div')
    staging.className = 'canvas-surface'
    staging.style.visibility = 'hidden'
    container.appendChild(staging)
    const candidate = new EditorRuntime()
    onLoadingChange(true)

    void (async () => {
      await candidate.startup(staging)
      if (cancelled) return
      await candidate.openDocument('latte://document', documentData)
      if (cancelled) return
      const previous = runtimeRef.current
      runtimeRef.current = candidate
      staging.style.visibility = 'visible'
      container.replaceChildren(staging)
      previous?.dispose()
      onRuntimeChange(candidate)
      onStatusChange('Document ready. Opened documents start a new history.')
    })()
      .catch(error => {
        if (!cancelled) onError(errorMessage(error))
      })
      .finally(() => {
        if (runtimeRef.current !== candidate) {
          candidate.dispose()
          staging.remove()
        }
        if (!cancelled) onLoadingChange(false)
      })

    return () => {
      cancelled = true
      if (runtimeRef.current !== candidate) {
        candidate.dispose()
        staging.remove()
      }
    }
  }, [documentData, onRuntimeChange, onLoadingChange, onError, onStatusChange])

  useEffect(
    () => () => {
      runtimeRef.current?.dispose()
      runtimeRef.current = null
      onRuntimeChange(null)
    },
    [onRuntimeChange]
  )

  return <div ref={containerRef} className="canvas-container" />
}

export function App() {
  const [runtime, setRuntime] = useState<EditorRuntime | null>(null)
  const [documentData, setDocumentData] = useState(sampleData)
  const [controller, setController] = useState<EditorSessionController | null>(
    null
  )
  const [selected, setSelected] = useState<SelectedNodeProperties | null>(null)
  const [selectionCount, setSelectionCount] = useState(0)
  const [history, setHistory] = useState({ canUndo: false, canRedo: false })
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const queue = useRef<Promise<void>>(Promise.resolve())
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = loading || working

  useEffect(() => {
    if (!runtime) return
    const session = new EditorSessionController(runtime)
    setController(session)
    let disposed = false
    let revision = 0
    const refresh = () => {
      setSelected(session.selected)
      setSelectionCount(session.selectionCount)
      const current = ++revision
      void session
        .historyState()
        .then(next => {
          if (!disposed && current === revision) setHistory(next)
        })
        .catch(error => {
          if (!disposed) setError(errorMessage(error))
        })
    }
    const listener = session.onDidChange(refresh)
    refresh()
    return () => {
      disposed = true
      listener.dispose()
      session.dispose()
    }
  }, [runtime])

  const run = (action: () => Promise<void>) => {
    const operation = queue.current.then(async () => {
      setWorking(true)
      setError('')
      try {
        await action()
      } catch (error) {
        setError(errorMessage(error))
        throw error
      } finally {
        setWorking(false)
      }
    })
    queue.current = operation.catch(() => undefined)
    return operation
  }

  const historyAction = (redo: boolean) => {
    if (controller)
      void run(() => (redo ? controller.redo() : controller.undo())).catch(
        () => undefined
      )
  }

  const activateTool = (id?: string) => {
    if (!runtime) return
    void run(async () => {
      if (id) runtime.workbench?.toolService.activateTool(id)
      else runtime.workbench?.toolService.deactivateCurrentTool()
    }).catch(() => undefined)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        loading ||
        target.closest('input, textarea, [contenteditable="true"]')
      )
        return
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' || key === 'y') {
        event.preventDefault()
        historyAction(key === 'y' || event.shiftKey)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const save = () => {
    if (!controller) return
    void run(async () => {
      const saved = await controller.save()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' })
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'document.latte.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('Document downloaded.')
    }).catch(() => undefined)
  }

  const load = (file: File) => {
    void run(async () => {
      if (runtime?.transformInteraction.isActive)
        throw new Error('Finish the current drag before loading a document.')
      const imported = validateDocument(JSON.parse(await file.text()))
      setLoading(true)
      setDocumentData(imported)
      setStatus(`Opening ${file.name}…`)
    }).catch(() => undefined)
  }

  const commit = (property: EditableProperty, value: string) => {
    if (!controller || !selected) return Promise.resolve()
    const id = selected.id
    return run(() => controller.updateProperty(id, property, value))
  }

  return (
    <div className="app-layout">
      <header className="header">
        <strong>Latte</strong>
        <button
          type="button"
          data-testid="select-tool"
          disabled={loading}
          onClick={() => activateTool()}
        >
          Select
        </button>
        <button
          type="button"
          data-testid="rectangle-tool"
          disabled={loading}
          onClick={() => activateTool('rectangle-tool')}
        >
          Rectangle
        </button>
        <span className="toolbar-separator" />
        <button
          type="button"
          data-testid="undo"
          disabled={loading || !history.canUndo}
          onClick={() => historyAction(false)}
        >
          Undo
        </button>
        <button
          type="button"
          data-testid="redo"
          disabled={loading || !history.canRedo}
          onClick={() => historyAction(true)}
        >
          Redo
        </button>
        <button
          type="button"
          data-testid="save-document"
          disabled={loading || !controller}
          onClick={save}
        >
          Save JSON
        </button>
        <button
          type="button"
          data-testid="load-document"
          disabled={loading || !controller}
          onClick={() => fileRef.current?.click()}
        >
          Open JSON
        </button>
        <input
          ref={fileRef}
          className="file-input"
          data-testid="document-file"
          type="file"
          accept=".json,application/json"
          onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) load(file)
          }}
        />
        <output data-testid="selection-count">
          Selected: {selectionCount}
        </output>
      </header>
      <div className="main-content">
        <div className="workspace" data-busy={busy}>
          <CanvasArea
            documentData={documentData}
            onRuntimeChange={setRuntime}
            onLoadingChange={setLoading}
            onError={setError}
            onStatusChange={setStatus}
          />
          {loading && <div className="loading">Opening document…</div>}
        </div>
        <PropertyPanel
          selected={selected}
          count={selectionCount}
          busy={busy}
          onCommit={commit}
        />
      </div>
      <footer className="status-bar">
        {error ? (
          <span role="alert">{error}</span>
        ) : (
          <span role="status">
            {loading ? 'Opening document…' : status || 'Ready'}
          </span>
        )}
      </footer>
    </div>
  )
}

export default App
