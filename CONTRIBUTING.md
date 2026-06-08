# Contributing to Latte

Thanks for helping improve Latte. This project is still pre-1.0, so architectural consistency matters as much as feature completeness.

## Project Shape

Latte is a pnpm/Turborepo monorepo. The key packages are:

| Package              | Responsibility                                                                |
| -------------------- | ----------------------------------------------------------------------------- |
| `@latte-js/bean`     | Shared types, file schema types and RPC contracts.                            |
| `@latte-js/espresso` | Shared-memory data kernel, SceneGraph, SoA layout and NodeCursor.             |
| `@latte-js/barista`  | Worker-side services, systems, mutation policy, transactions and history.     |
| `@latte-js/crema`    | Runtime assembly, worker client, projection sync and interaction controllers. |
| `@latte-js/art`      | Read-only renderer, camera and hit testing.                                   |
| `@latte-js/syrup`    | Main-thread platform services: DI, commands, menus, keybindings and input.    |
| `@latte-js/counter`  | Built-in workbench contributions, tools and selection state.                  |
| `@latte-js/milk`     | React UI components and panels.                                               |
| `@latte-js/kit`      | Shared runtime utilities.                                                     |

## Setup

```bash
pnpm install
pnpm build
pnpm dev
```

Open `http://localhost:5173` for the demo app.

## Architecture Rules

### 1. Dependency Direction

Keep package dependencies intentional and acyclic. Lower-level packages must not import product/UI packages.

Expected flow:

```text
apps/cafe
  -> crema / counter / milk / art
  -> syrup / barista
  -> espresso
  -> bean
```

### 2. Worker-Authoritative Writes

Document model writes must end in the worker-side path:

```text
main-thread service facade
  -> RPC
  -> worker service
  -> MutationGate
  -> System / Manager
  -> NodeCursor
  -> SharedArrayBuffer / SoA
```

Renderers, React components and main-thread workbench code read projections and session state. They must not mutate document data directly.

### 3. NodeCursor Is the Mutation Gateway

Business mutations should use `NodeCursor` so mutation records, dirty flags, observers and history stay coherent. Direct typed-array access is restricted to low-level Espresso ops and carefully reviewed internal code.

### 4. Mutation Policy and Transactions

Do not make callers manually open transactions from the main thread. Worker services/systems declare mutation policy and `MutationGate` handles automatic transaction boundaries.

Use explicit policies such as:

- `readonly`
- `writeNoHistory`
- `atomic`
- `sessionBegin`
- `sessionMutation`
- `sessionCommit`
- `sessionCancel`
- `manual`

If a service method writes document data, it needs an intentional policy and tests.

### 5. Transaction and History Are Separate

- `TransactionManager` records the lifecycle of a single edit.
- `HistoryManager` owns undo/redo stacks and inverse replay.
- `UndoRedoService` exposes user-facing undo/redo operations.

Undo/redo replay should reuse the same mutation application path and should not write raw SAB fields directly.

### 6. Transform and Layout Are Separate

Free transform belongs in transform systems. Frame resize, constraints, auto layout and group auto-bounds belong in layout systems/services.

See [docs/figma-layout-resize-plan.zh-CN.md](./docs/figma-layout-resize-plan.zh-CN.md).

### 7. Runtime Validation Belongs at Boundaries

Runtime schema validation is appropriate for file import, plugin manifests, external commands, RPC payloads and configuration. Do not add heavy validation inside NodeCursor, SoA hot paths, matrix/AABB ticks or renderer loops.

## Development Workflow

When adding a feature:

1. Define shared types in `@latte-js/bean` when the feature crosses package or RPC boundaries.
2. Add storage support in `@latte-js/espresso` only when the data belongs in the document model.
3. Add worker service/system behavior in `@latte-js/barista` for authoritative writes or heavy computation.
4. Add runtime wiring in `@latte-js/crema` when the main thread must call worker-backed services.
5. Add built-in tool/command behavior in `@latte-js/counter`.
6. Add rendering or hit-test behavior in `@latte-js/art`.
7. Add UI in `@latte-js/milk`.
8. Update docs and tests with the same PR.

## Testing

Use focused package checks while developing:

```bash
pnpm --filter @latte-js/espresso test
pnpm --filter @latte-js/barista test
pnpm --filter @latte-js/crema test
pnpm --filter @latte-js/cafe build
```

Before opening a PR, run the release gate that applies to your change:

```bash
pnpm release:check
```

Geometry changes should include tests that verify rendered/world-space results, not only local matrix fields.

## Documentation

Update documentation when changing architecture, public APIs, package boundaries, license policy or contributor workflow.

Important docs:

- [README.md](./README.md)
- [docs/roadmap.zh-CN.md](./docs/roadmap.zh-CN.md)
- [docs/architecture-blueprint.zh-CN.md](./docs/architecture-blueprint.zh-CN.md)
- [docs/governance-and-licensing.zh-CN.md](./docs/governance-and-licensing.zh-CN.md)

## Pull Requests

- Keep PRs focused and reviewable.
- Use Conventional Commits when possible, such as `feat: add transform target tests`.
- Include tests for behavior changes.
- Explain architectural boundary changes in the PR description.
- Do not reformat unrelated files.
- Do not commit generated reports, local caches or build outputs unless they are intentionally tracked.

## License and Commercialization

Latte uses package-level licenses. Core/product packages are `AGPL-3.0-or-later` with commercial licensing available; protocol/SDK/UI infrastructure packages are currently `MIT`.

External contributions may require a CLA or equivalent contributor authorization before being included in a commercial dual-license release. This is not legal advice; maintainers should confirm final policy with counsel before a public 1.0 launch.

## Reporting Issues

For bugs, include:

- OS and browser.
- Node/pnpm versions.
- Steps to reproduce.
- Expected and actual behavior.
- Console/page errors when available.

For feature requests, describe the user workflow, why it matters and whether it affects Figma-like editing semantics, VSCode-like platform APIs or both.
