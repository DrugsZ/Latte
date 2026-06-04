import { createDecorator } from '../instantiation/instantiation'

import type { Editor } from '../../core/editor'

export interface IEditorService {
  readonly activeEditor: Editor | null
}

export const IEditorService = createDecorator<IEditorService>('editorService')
