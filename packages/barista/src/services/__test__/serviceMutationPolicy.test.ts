import { Channels, DEFAULT_SCENE_GRAPH_NAME, NodeType } from '@latte-js/bean'
import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { BaristaSystem, getRegisteredSystems } from '../../systems'
import { DocumentService } from '../document'
import { NodeService } from '../node'
import { QueryService } from '../query'
import {
  collectMutationPolicyCoverageIssues,
  getServiceCallMethodNames,
} from '../serviceAudit'
import { getRegisteredServices, ServiceBase } from '../serviceBase'
import { TransformService } from '../transform'
import { UndoRedoService } from '../undoRedo'
import { MutationPolicyKind } from '../../transactions/mutationPolicy'
import { TransactionLabel } from '../../transactions/transactionLabels'

const createContext = (graph: SceneGraph) => ({
  sceneGraph: graph,
  mutationAuthority: graph.createMutationAuthority('test'),
  accessSystem: new BaristaSystem(graph),
  currentSessionId: DEFAULT_SCENE_GRAPH_NAME,
  getService: () => {
    throw new Error('getService is not used in mutation policy tests')
  },
})

describe('service mutation policies', () => {
  it('resolves service-level mutation policies registered by decorator', () => {
    const transform = new TransformService(createContext(new SceneGraph()))

    expect(transform.getMutationPolicy('moveBy$', [])).toMatchObject({
      kind: MutationPolicyKind.SessionMutation,
    })
  })

  it('falls back to system-level mutation policies registered by decorator', () => {
    const graph = new SceneGraph()
    const transform = new TransformService(createContext(graph))
    const node = new NodeService(createContext(graph))

    expect(
      transform.getMutationPolicy('moveBy', [['test:rect']])
    ).toMatchObject({
      kind: MutationPolicyKind.Atomic,
      label: TransactionLabel.MoveLayer,
    })
    expect(
      node.getMutationPolicy('createNode', [{ id: 'test:rect' }])
    ).toMatchObject({
      kind: MutationPolicyKind.Atomic,
      label: TransactionLabel.CreateLayer,
    })
  })

  it('resolves explicitly declared readonly policies', () => {
    const query = new QueryService(createContext(new SceneGraph()))

    expect(query.getMutationPolicy('getElementsByName', [])).toMatchObject({
      kind: MutationPolicyKind.Readonly,
    })
  })

  it('rejects methods without a declared mutation policy', () => {
    const query = new QueryService(createContext(new SceneGraph()))

    expect(() => query.getMutationPolicy('missingMethod', [])).toThrow(
      'Missing mutation policy'
    )
  })

  it('rejects query options with a missing root id', async () => {
    const query = new QueryService(createContext(new SceneGraph()))

    await expect(
      query.getElementsByType(NodeType.RECTANGLE, {
        rootId: 'test:missing',
      })
    ).rejects.toThrow('[QueryService] Root node not found: test:missing')
  })

  it('only filters explicit event-style service methods from audit', () => {
    class AuditService extends ServiceBase {
      public static readonly name = Channels.Document

      onboard() {}
      online() {}
      _resolveSomething() {}
      onDidChange() {}
      onWillSave() {}
    }

    expect(getServiceCallMethodNames(AuditService)).toEqual([
      'onboard',
      'online',
    ])
  })

  it('declares mutation policy coverage for every registered call method', () => {
    void DocumentService
    void NodeService
    void QueryService
    void TransformService
    void UndoRedoService

    const fallbackPoliciesByService = new Map(
      getRegisteredSystems().map(system => [
        system.name,
        system.mutationPolicies ?? {},
      ])
    )

    expect(getRegisteredServices().map(service => service.name)).toEqual(
      expect.arrayContaining([
        'document',
        'node',
        'query',
        'transform',
        'undoRedo',
      ])
    )
    expect(
      collectMutationPolicyCoverageIssues({ fallbackPoliciesByService })
    ).toEqual([])
  })
})
