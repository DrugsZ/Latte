import { Channels, type IUndoRedoService } from '@latte-js/bean'

import { getHistoryManager } from '../transactions/transactionRegistry'
import { service, ServiceBase, type IContext } from './serviceBase'

import {
  MutationPolicyKind,
  type MutationPolicyMap,
} from '../transactions/mutationPolicy'

const undoRedoMutationPolicies: MutationPolicyMap = {
  undo: { kind: MutationPolicyKind.History },
  redo: { kind: MutationPolicyKind.History },
  canUndo: { kind: MutationPolicyKind.Readonly },
  canRedo: { kind: MutationPolicyKind.Readonly },
}

@service({ mutations: undoRedoMutationPolicies })
export class UndoRedoService extends ServiceBase implements IUndoRedoService {
  public static readonly name = Channels.UndoRedo

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async undo() {
    return getHistoryManager(this.sceneGraph).undo()
  }

  public async redo() {
    return getHistoryManager(this.sceneGraph).redo()
  }

  public async canUndo() {
    return getHistoryManager(this.sceneGraph).canUndo
  }

  public async canRedo() {
    return getHistoryManager(this.sceneGraph).canRedo
  }
}
