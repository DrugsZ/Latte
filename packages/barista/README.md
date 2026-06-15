# @latte-js/barista

Worker-side execution engine for Latte.

## Responsibility

- Host document services exposed to the main thread through RPC.
- Run systems such as matrix, AABB, query, transform and future layout/constraints.
- Enforce mutation policy through `MutationGate`.
- Manage transaction lifecycle through `TransactionManager`.
- Manage undo/redo stacks and inverse replay through `HistoryManager` and `UndoRedoService`.

## Boundaries

- Owns document model writes together with `@latte-js/espresso`.
- Does not depend on DOM, React or main-thread input details.
- Long-term history belongs to `HistoryManager`; transaction lifecycle belongs to `TransactionManager`.
- Replay paths should reuse NodeCursor/mutation application instead of writing raw SAB fields directly.

## Development

```bash
pnpm --filter @latte-js/barista type-check
pnpm --filter @latte-js/barista test
pnpm --filter @latte-js/barista build
```

## License

`AGPL-3.0-or-later`, with commercial licensing available for the core/product edition.
