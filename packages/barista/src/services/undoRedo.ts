import { Channels, type IUndoRedoService } from '@latte-js/bean'

import { getHistoryManager } from '../transactions/transactionRegistry'
import { Service, ServiceBase, type IContext } from './serviceBase'

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

@Service({ mutations: undoRedoMutationPolicies })
export class UndoRedoService extends ServiceBase implements IUndoRedoService {
  public static readonly name = Channels.UndoRedo

  constructor(ctx: IContext) {
    super(ctx)
  }

  public async undo() {
    return getHistoryManager(this.sceneGraph, this.mutationAuthority).undo(
      this.currentSessionId
    )
  }

  public async redo() {
    return getHistoryManager(this.sceneGraph, this.mutationAuthority).redo(
      this.currentSessionId
    )
  }

  public async canUndo() {
    return getHistoryManager(this.sceneGraph, this.mutationAuthority).canUndo(
      this.currentSessionId
    )
  }

  public async canRedo() {
    return getHistoryManager(this.sceneGraph, this.mutationAuthority).canRedo(
      this.currentSessionId
    )
  }
}
