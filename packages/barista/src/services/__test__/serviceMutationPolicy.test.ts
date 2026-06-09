import { SceneGraph } from '@latte-js/espresso'
import { describe, expect, it } from 'vitest'

import { BaristaSystem, getRegisteredSystems } from '../../systems'
import { DocumentService } from '../document'
import { NodeService } from '../node'
import { QueryService } from '../query'
import {
  collectMutationPolicyCoverageIssues,
  getRegisteredServices,
} from '../serviceBase'
import { TransformService } from '../transform'
import { UndoRedoService } from '../undoRedo'
import { MutationPolicyKind } from '../../transactions/mutationPolicy'

const createContext = (graph: SceneGraph) => ({
  sceneGraph: graph,
  accessSystem: new BaristaSystem(graph),
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
      label: 'Move Layer',
    })
    expect(node.getMutationPolicy('create', [])).toMatchObject({
      kind: MutationPolicyKind.WriteNoHistory,
    })
  })

  it('defaults unspecified methods to readonly', () => {
    const query = new QueryService(createContext(new SceneGraph()))

    expect(query.getMutationPolicy('getElementByName', [])).toMatchObject({
      kind: MutationPolicyKind.Readonly,
    })
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
