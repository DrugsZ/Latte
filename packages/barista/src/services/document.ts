import {
  Channels,
  type IDocumentService,
  type IDType,
  type ILatteFile,
} from '@latte-js/bean'
import { LatteLoader, Serializer } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'

import { Service, ServiceBase, type IContext } from './serviceBase'

import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'

const documentMutationPolicies: MutationPolicyMap = {
  load: { kind: MutationPolicyKind.WriteNoHistory },
  save: { kind: MutationPolicyKind.Readonly },
}

interface DocumentLoadEvent {
  readonly sessionId: string
  readonly map: Map<IDType, number>
}

interface DocumentSaveEvent {
  readonly sessionId: string
}

@Service({ mutations: documentMutationPolicies })
export class DocumentService extends ServiceBase implements IDocumentService {
  public static readonly name = Channels.Document

  private _onLoad = new Emitter<DocumentLoadEvent>()
  private _onSave = new Emitter<DocumentSaveEvent>()

  constructor(ctx: IContext) {
    super(ctx)
  }

  async load(data: ILatteFile) {
    const sessionId = this.currentSessionId
    const loader = new LatteLoader(this.sceneGraph)
    await loader.load(data)
    const map = this.sceneGraph.getUUIDMap()
    this._onLoad.fire({ sessionId, map })
    return map
  }

  async save(): Promise<ILatteFile> {
    const sessionId = this.currentSessionId
    const serializer = new Serializer(this.sceneGraph)
    this._onSave.fire({ sessionId })
    return serializer.serialize()
  }

  onLoad(callback: (map: Map<IDType, number>) => void) {
    const sessionId = this.currentSessionId
    return this._onLoad.event(event => {
      if (event.sessionId === sessionId) {
        callback(event.map)
      }
    })
  }

  onSave(callback: () => void) {
    const sessionId = this.currentSessionId
    return this._onSave.event(event => {
      if (event.sessionId === sessionId) {
        callback()
      }
    })
  }
}
