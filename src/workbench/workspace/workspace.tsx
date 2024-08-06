import { TransformPanel } from 'workbench/workspace/transformPanel'
import { FillPanel } from 'workbench/workspace/fill/fillPanel'
import type { KeyboardEventHandler } from 'react'

const stopPropagationAndDefault: KeyboardEventHandler<
  HTMLDivElement
> = event => {
  event.stopPropagation()
}

export const WorkspacePart = props => (
  <div className="workspace" onKeyDown={stopPropagationAndDefault}>
    <TransformPanel />
    <FillPanel />
  </div>
)
