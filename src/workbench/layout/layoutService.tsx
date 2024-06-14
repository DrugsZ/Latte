import type { Part } from 'workbench/layout/part'
import 'workbench/layout/layout.css'
import { EditorPart } from 'workbench/layout/editorPart'
import { Panel } from 'workbench/panel/panel'
import { ToolBarPart } from 'workbench/toolbar/toolbar'
import { WorkspacePart } from 'workbench/workspace/workspace'

import { useEffect, useRef } from 'react'

export const enum Parts {
  TOOL_BAR = 'workbench.parts.toolbar',
  SIDEBAR_PART = 'workbench.parts.sidebar',
  PANEL_PART = 'workbench.parts.panel',
  EDITOR_PART = 'workbench.parts.editor',
  WORKSPACE_PART = 'workbench.parts.workspace',
}

class Layout {
  private _mainContainer: HTMLElement
  private _parts: Map<string, Part> = new Map()
  registerPart(part: Part) {
    this._parts.set(part.id, part)
  }

  protected getPart(key: Parts): Part {
    const part = this._parts.get(key)
    if (!part) {
      throw new Error(`Unknown part ${key}`)
    }

    return part
  }

  private _createContainer(classes: string[]) {
    const part = document.createElement('div')
    part.classList.add(...classes)
    this._mainContainer.append(part)
    return part
  }

  private _renderParts() {
    // eslint-disable-next-line no-restricted-syntax
    for (const { part, classes } of [
      { part: Parts.TOOL_BAR, classes: ['toolbar'] },
      // { part: Parts.SIDEBAR_PART, classes: ['sidebar'] },
      { part: Parts.PANEL_PART, classes: ['panel'] },
      { part: Parts.EDITOR_PART, classes: ['editor'] },
      { part: Parts.WORKSPACE_PART, classes: ['workspace'] },
    ]) {
      const parentContainer = this._createContainer(classes)
      this.getPart(part)?.create(parentContainer)
    }
  }

  startup(domElement: HTMLElement) {
    this._mainContainer = domElement
    this._renderParts()
  }
}

export const layout = new Layout()

export function registerPart(part: Part) {
  layout.registerPart(part)
}

// registerPart(new EditorPart(Parts.EDITOR_PART))
// registerPart(new ToolBarPart(Parts.TOOL_BAR))
// registerPart(new PanelPart(Parts.PANEL_PART))
// registerPart(new WorkspacePart(Parts.WORKSPACE_PART))

export const App = () => {
  const editorDOMRef = useRef<HTMLElement>()
  useEffect(() => {
    if (!editorDOMRef.current) {
      return
    }
    new EditorPart(Parts.EDITOR_PART).create(editorDOMRef.current)
  }, [])
  return (
    <>
      <ToolBarPart />
      <Panel />
      <div ref={editorDOMRef} className="editor"></div>
      <WorkspacePart />
    </>
  )
}
