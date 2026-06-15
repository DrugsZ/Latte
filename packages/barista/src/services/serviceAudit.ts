import type { MutationPolicyMap } from '../transactions/mutationPolicy'
import { getRegisteredServices, type ServiceConstructor } from './serviceBase'

export interface IMutationPolicyCoverageIssue {
  readonly serviceName: string
  readonly methodName: string
}

export interface IMutationPolicyCoverageOptions {
  readonly fallbackPoliciesByService?: ReadonlyMap<string, MutationPolicyMap>
  readonly ignoredMethods?: readonly string[]
}

export function collectMutationPolicyCoverageIssues(
  options: IMutationPolicyCoverageOptions = {}
): IMutationPolicyCoverageIssue[] {
  const issues: IMutationPolicyCoverageIssue[] = []
  const ignored = new Set(options.ignoredMethods ?? [])

  for (const constructor of getRegisteredServices()) {
    const servicePolicies = constructor.mutationPolicies ?? {}
    const fallbackPolicies = constructor.systemName
      ? (options.fallbackPoliciesByService?.get(constructor.systemName) ?? {})
      : {}

    for (const methodName of getServiceCallMethodNames(constructor)) {
      if (
        ignored.has(methodName) ||
        servicePolicies[methodName] ||
        fallbackPolicies[methodName]
      ) {
        continue
      }

      issues.push({
        serviceName: constructor.name,
        methodName,
      })
    }
  }

  return issues
}

export function getServiceCallMethodNames(
  constructor: ServiceConstructor
): string[] {
  return Object.getOwnPropertyNames(constructor.prototype).filter(name => {
    if (
      name === 'constructor' ||
      name.startsWith('_') ||
      isServiceEventMethodName(name)
    ) {
      return false
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      constructor.prototype,
      name
    )
    return typeof descriptor?.value === 'function'
  })
}

export function isServiceEventMethodName(name: string) {
  return /^(onDid|onWill)[A-Z]/.test(name)
}
