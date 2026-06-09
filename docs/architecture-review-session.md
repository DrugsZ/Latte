# Latte Architecture Review Notes

This document summarizes the architecture changes made during the current
review/implementation session. It is intended as a guided checklist for code
review.

## Target Direction

The current architecture direction is:

```txt
Main thread
  VSCode-like services, commands, keybindings, tools
    -> typed RPC services such as NodeService / TransformService
       / UndoRedoService

Worker
  domain services
    -> systems
    -> NodeCursor / SceneGraph write barrier
    -> TransactionManager transaction records
    -> HistoryManager undo/redo stacks
    -> dirty pipeline

Render
  read-only projection over SharedArrayBuffer
```

The main thread should keep semantic APIs. It should not use a raw mutation
action bus as the primary programming model.

## Review Order

1. Review the data boundary in `packages/espresso`.
2. Review worker transaction and history behavior in `packages/barista`.
3. Review runtime orchestration in `packages/crema`.
4. Review app integration in `apps/cafe`.
5. Review tests and e2e coverage.

## Data Layer: `packages/espresso`

### Shared Memory And Metadata

The SoA layout was extended so render metadata can live in shared memory:

- `packages/espresso/src/data/memoryLayout.ts`
- `packages/espresso/src/data/sceneGraph.ts`
- `packages/espresso/src/data/heapManager.ts`
- `packages/espresso/src/data/blobManager.ts`
- `packages/espresso/src/data/ops/styleOps.ts`

This supports the worker-load, main-thread-read projection model for names,
fills, strokes, and related render metadata.

### Defensive SAB Initialization

`SceneGraph` now defensively initializes blank external buffers so hierarchy
columns use `NULL_INDEX` instead of accidental zeroes. This prevents root
self-cycles when attaching to an externally created SharedArrayBuffer.

Review:

- `packages/espresso/src/data/sceneGraph.ts`
- `packages/espresso/src/data/__test__/sceneGraph.test.ts`

### Write Barrier And Mutation Recording

`NodeCursor` is now the main write barrier for user-editable properties. It
records a mutation after applying the write and before marking dirty.

New type:

- `packages/espresso/src/data/mutationRecorder.ts`

Integration:

- `SceneGraph.setMutationRecorder(...)`
- `SceneGraph.recordMutation(...)`
- `NodeCursor._mutate(...)`
- `NodeCursor.appendChild(...)`
- `NodeCursor.removeChild(...)`
- `NodeCursor.delete(...)`

The recorded shape is:

```ts
{
  id,
  index,
  prop,
  oldValue,
  newValue,
  dirtyFlag
}
```

Important boundary:

- User edits through `NodeCursor` are recordable.
- Derived pipeline writes such as `worldMatrix` and `aabb` still use lower
  level ops and should not enter undo/redo history.

Tests:

- `packages/espresso/src/data/__test__/nodeCursor.test.ts`

## Worker Layer: `packages/barista`

### Transaction Manager / History Manager

`TransactionManager` only owns the current transaction lifecycle:

- `begin` / `capture` / `recordMutation`
- `commit` returns committed transaction records
- `abort` rolls back the current transaction through inverse records

It implements `IMutationRecorder`, receives `NodeCursor` mutation records while
a transaction is active, and no longer stores undo/redo stacks.

`HistoryManager` owns history state:

- stores undo/redo stacks
- receives committed transactions returned by `TransactionManager.commit()`
- builds inverse records
- delegates replay to `MutationRecordApplier`

`MutationRecordApplier` is the shared writeback entry for undo/redo and
transaction abort. It applies `INodeMutationRecord` through the
`NodeCursor` / `SceneGraph` write barrier, avoiding a second direct-SAB replay
path for history.

Review:

- `packages/barista/src/transactions/transactionManager.ts`
- `packages/barista/src/history/historyManager.ts`
- `packages/barista/src/history/mutationRecordApplier.ts`
- `packages/barista/src/transactions/__test__/transactionManager.test.ts`
- `packages/barista/src/history/__test__/historyManager.test.ts`

Commit behavior:

```txt
active records
  -> clone forward records
  -> return committed transaction
  -> MutationGate pushes it into HistoryManager
```

Undo behavior:

```txt
HistoryManager pops undo entry
  -> MutationRecordApplier replays inverse records
  -> push entry to redo stack
```

Redo behavior:

```txt
HistoryManager pops redo entry
  -> MutationRecordApplier replays forward records
  -> push entry to undo stack
```

Current replay support covers common `NodeCursor` editable properties:

- transform: `x`, `y`, `width`, `height`, `transform`
- style: fills, strokes, opacity, visibility, stroke settings, radius
- metadata: name, locked
- hierarchy parent changes, with current sibling-order limitations

Current limitation:

- Reversible `removeSelf` replay still requires serialized node snapshots.
  Until snapshots exist, `SceneGraph.deleteNode()`/`NodeCursor.delete()` throws
  before mutating data inside a history mutation scope, preventing poison
  history journals. The `MutationRecordApplier` replay branch keeps a defensive
  error as the final guard.

### Internal Transaction Registry And Undo/Redo Service

`TransactionManager` and `HistoryManager` are shared per `SceneGraph` through a
weak registry so all worker services participate in the same active transaction
and history stacks. They are worker-internal infrastructure, not a public RPC
surface for the main thread or plugins.

Review:

- `packages/barista/src/transactions/mutationPolicy.ts`
- `packages/barista/src/transactions/transactionRegistry.ts`
- `packages/barista/src/ipc/proxyChannel.ts`
- `packages/barista/src/ipc/channelServer.ts`
- `packages/barista/src/services/serviceBase.ts`
- `packages/barista/src/systems/systems.ts`
- `packages/barista/src/services/undoRedo.ts`
- `packages/bean/src/rpc/undoRedo.ts`

Public service boundary:

- `UndoRedoService`: `undo`, `redo`, `canUndo`, `canRedo`

The RPC/service dispatcher owns transaction boundaries through `MutationGate`.
Services and systems declare method policies at registration time with
`@service({ mutations: ... })` or `@system({ mutations: ... })`. Service-level
policies win; otherwise the dispatcher falls back to the matching system policy.
A standalone semantic RPC such as `TransformService.moveBy(...)` is
automatically wrapped in a worker transaction. Continuous interactions use
domain sessions such as `TransformService.beginTransform(...)`,
`commitTransform()`, and `cancelTransform()`; these are transform interaction
APIs, not generic transaction APIs.

This keeps plugin and main-thread code from calling dangerous
`begin/commit/abort` primitives directly. A rename, style change, node move, or
future add/delete API should follow the same pattern: expose semantic RPC,
declare its mutation policy, then let the dispatcher wrap the actual
`NodeCursor` writes.

Policy kinds currently cover `readonly`, `writeNoHistory`, `manual`, `atomic`,
`sessionBegin`, `sessionMutation`, `sessionCommit`, `sessionCancel`, and
`history`. `manual` is reserved for complex methods that need fine-grained
worker-internal `TransactionManager` control without exposing generic
transaction APIs to the main thread.

`ChannelServer` now processes messages sequentially. This prevents active graph
session switches and write transactions from interleaving when multiple
documents or collaborators send RPC calls close together.

Tests:

- `packages/barista/src/ipc/__test__/channelServer.test.ts`
- `packages/barista/src/services/__test__/serviceMutationPolicy.test.ts`
- `packages/barista/src/services/__test__/transformServiceTransactions.test.ts`

### Transform System And Service

`TransformSystem` now exposes transform-specific domain behavior only. It may
read the active transaction snapshot to make drag deltas stable, but it no
longer owns transaction lifecycle or undo/redo.

Review:

- `packages/barista/src/systems/transform.ts`
- `packages/barista/src/services/transform.ts`
- `packages/bean/src/rpc/transform.ts`

Tests:

- `packages/barista/src/systems/__test__/transformSystem.test.ts`

### Removed Mutation RPC

The public `MutationService` / `MutationOperation` / `Channels.Mutation` path
was removed.

Reason:

- The main thread should remain VSCode-like with typed semantic RPC services.
- Raw mutation operations are an internal journal concern, not the public
  programming model.

Files removed:

- `packages/barista/src/services/mutation.ts`
- `packages/barista/src/services/__test__/mutationService.test.ts`
- `packages/bean/src/rpc/mutation.ts`

Confirm no residual references:

```sh
rg -n "MutationService|IMutationService|MutationOperation|Channels\\.Mutation|mutationService|rpc/mutation|services/mutation" packages apps
```

## Runtime Layer: `packages/crema`

`@latte-js/crema` was added as the editor runtime orchestration package.

Review:

- `packages/crema/package.json`
- `packages/crema/src/editorRuntime.ts`
- `packages/crema/src/interactions/transformInteractionController.ts`
- `packages/crema/src/interactions/__test__/transformInteractionController.test.ts`

Responsibilities:

- start editor
- register render bridge
- load document through worker
- expose transform interaction helpers
- dispose renderer and listeners

`TransformInteractionController` coordinates only the main-thread transform
interaction flow. Transform lifecycle calls are delegated to
`TransformService`; history controls stay on `UndoRedoService` instead of
being proxied through the interaction controller.

During dragging:

```txt
moveBy(...)
  -> coalesced requestAnimationFrame update
  -> transformService.moveBy$ notification
```

During commit:

```txt
flush pending update with transformService.moveBy request
  -> transformService.commitTransform
```

## Render Layer: `packages/art`

Renderer improvements:

- active root support
- `Renderer.fitToContent(rootId?, padding?)`
- read-only render projection over the graph
- tree traversal guards for cycles
- rAF lifecycle cleanup via `dispose`

Review:

- `packages/art/src/core/render.ts`
- `packages/art/src/render/canvas/canvas2DBackend.ts`

## Worker Pipeline

The worker computes dirty derived state after service calls:

```txt
RPC call / notification
  -> ChannelServer.onMessage
  -> BaristaEngine.scheduleTick
  -> MatrixSystem
  -> AABBSystem
  -> scene.onDirty
```

Review:

- `packages/barista/src/worker/baristaEngine.ts`
- `packages/barista/src/systems/matrix.ts`
- `packages/barista/src/systems/aabb.ts`

Cycle guards were added to avoid unbounded traversal.

## App Integration: `apps/cafe`

`apps/cafe` now uses `EditorRuntime` instead of wiring editor, bridge, and
document load manually.

Review:

- `apps/cafe/src/app.tsx`
- `apps/cafe/package.json`
- `apps/cafe/vite.config.js`

Vite dev and preview include COOP/COEP headers so SharedArrayBuffer is usable.

## Test And Tooling

New or relevant coverage:

- SAB blank external buffer initialization
- loader root topology
- cycle guards in matrix/AABB traversal
- render `fitToContent`
- worker load and read-only projection smoke
- transform transaction abort/commit
- dispatcher-owned transform transaction behavior
- service/system registration-time mutation policy resolution
- sequential channel dispatch for conflict avoidance
- transaction mutation recording
- history undo/redo
- runtime interaction coalescing and typed service delegation

Key files:

- `e2e/cafe-smoke.spec.ts`
- `playwright.config.ts`
- `turbo.json`
- root `package.json`

## Verification Commands

The current state was verified on 2026-06-04 with:

```sh
pnpm type-check
pnpm test
pnpm --filter @latte-js/cafe build
pnpm --filter @latte-js/espresso build
pnpm --filter @latte-js/barista build
pnpm --filter @latte-js/espresso test
pnpm --filter @latte-js/barista test
pnpm licenses:check
git diff --check
```

`pnpm e2e` was attempted, but this machine is missing the Playwright Chromium
executable at
`/Users/wt/Library/Caches/ms-playwright/chromium_headless_shell-1200/.../chrome-headless-shell`.
Run `pnpm exec playwright install chromium`, or
`pnpm exec playwright install --with-deps chromium` in CI, before using it as a
release gate.

Note: the `@latte-js/espresso` timeout risk was tightened on 2026-06-04. Test
runtime capacity now defaults to 20k nodes while production still defaults to
1M nodes, and `SceneGraph` no longer initializes every matrix slot during
construction. The latest `pnpm --filter @latte-js/espresso test` passed 14
files / 141 tests; serializer and node type conversion tests no longer hit the
default 5s per-test timeout.

## Known Follow-Ups

1. Move node create/delete/reparent into domain services that write through
   `NodeCursor` or an equivalent structural write barrier.
2. Add serialized node snapshots so `removeSelf` can undo/redo safely.
3. Preserve sibling order for parent history replay.
4. Connect command/keybinding entries for undo/redo.
5. Add UI-level smoke for an actual transform followed by undo/redo.
6. Audit direct typed-array writes and classify them as either user edit writes
   or derived pipeline writes.

## Review Checklist

- Main thread does not use raw mutation RPC.
- Main thread does not use generic transaction RPC.
- Public APIs remain typed service APIs.
- Mutation policies are declared on service/system registration and enforced by
  the worker dispatcher.
- Worker RPC calls are processed sequentially to avoid active session
  interleaving.
- Worker writes that represent user edits flow through `NodeCursor`.
- Pipeline writes do not pollute history.
- Transaction commit creates undo entries only when records exist.
- Undo/redo replay does not create new history entries.
- `TransformService` owns transform interaction session boundaries internally.
- Transaction abort uses recorded inverse mutations plus transform snapshots for
  immediate rollback.
- Existing cafe sample still renders with SharedArrayBuffer enabled.
