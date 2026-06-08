# @latte-js/espresso

Shared-memory data kernel for Latte.

## Responsibility

- Store the scene graph in `SharedArrayBuffer` using a Structure-of-Arrays layout.
- Manage LCRS tree topology, allocation, ID/index mapping and shared heap/blob pointer storage.
- Provide `NodeCursor` as the supported read/write abstraction for document data.
- Provide loader/serializer support for Latte file data.
- Keep the current JS heap/blob implementation simple and temporary: append-only writes plus tombstone release, with future Rust/WASM storage free to replace the internals behind the same pointer-column contract.

## Boundaries

- Does not implement UI, renderer loops, worker RPC services or product tools.
- Direct typed-array access should stay inside low-level ops and carefully reviewed internal code.
- Business mutations should use `NodeCursor` so mutation records, dirty flags and history can stay coherent.
- Rust/WASM migration must preserve the public `SceneGraph`/`NodeCursor` boundary instead of exposing native memory ownership to callers.

## Development

```bash
pnpm --filter @latte-js/espresso type-check
pnpm --filter @latte-js/espresso test
pnpm --filter @latte-js/espresso build
```

## License

`AGPL-3.0-or-later`, with commercial licensing available for the core/product edition.
