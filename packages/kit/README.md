# @latte-js/kit

Shared runtime utilities for Latte packages.

## Responsibility

- Event primitives such as `Emitter`.
- Lifecycle helpers such as `Disposable` and `DisposableStore`.
- Common data structures and platform helpers.
- Small infrastructure utilities that are not tied to document semantics.

## Boundaries

- No editor product behavior.
- No document model writes.
- No dependency on AGPL core packages unless the package is intentionally reclassified.

## Development

```bash
pnpm --filter @latte-js/kit test
pnpm --filter @latte-js/kit build
```

## License

`MIT`.
