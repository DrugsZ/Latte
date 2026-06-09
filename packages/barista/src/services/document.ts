import {
  Channels,
  type IDocumentService,
  type IDType,
  type ILatteFile,
} from '@latte-js/bean'
import { LatteLoader, Serializer } from '@latte-js/espresso'
import { Emitter } from '@latte-js/kit'

import { service, ServiceBase, type IContext } from './serviceBase'

import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'

const documentMutationPolicies: MutationPolicyMap = {
  load: { kind: MutationPolicyKind.WriteNoHistory },
  save: { kind: MutationPolicyKind.Readonly },
}

@service({ mutations: documentMutationPolicies })
export class DocumentService extends ServiceBase implements IDocumentService {
  public static readonly name = Channels.Document

  private _onLoad = new Emitter<Map<IDType, number>>()
  public readonly onLoad = this._onLoad.event
  private _onSave = new Emitter<void>()
  public readonly onSave = this._onSave.event

  constructor(ctx: IContext) {
    super(ctx)
  }

  async load(data: ILatteFile) {
    const loader = new LatteLoader(this.sceneGraph)
    await loader.load(data)
    const map = this.sceneGraph.getUUIDMap()
    this._onLoad.fire(map)
    return map
  }

  async save(): Promise<ILatteFile> {
    const serializer = new Serializer(this.sceneGraph)
    this._onSave.fire()
    return serializer.serialize()
  }
}
