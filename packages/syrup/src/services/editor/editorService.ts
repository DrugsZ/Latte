import { createDecorator } from '../instantiation/instantiation'

import type { EditorHost } from '../../core/editorHost'

export interface IEditorService {
  readonly activeEditor: EditorHost | null
}

export const IEditorService = createDecorator<IEditorService>('editorService')
