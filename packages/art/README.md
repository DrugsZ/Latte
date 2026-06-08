# @latte-js/art

Read-only rendering and hit testing for Latte.

## Responsibility

- Render the shared Espresso projection to Canvas/WebGL-compatible backends.
- Manage camera zoom, pan and viewport fitting.
- Build renderer-local acceleration structures such as RTree.
- Provide hit testing and coordinate conversion for the main-thread interaction layer.

## Boundaries

- Must not mutate the document model.
- Must not own transaction, history or service semantics.
- Reads `@latte-js/espresso` projection data and requests redraws when projection dirty/version changes.

## Development

```bash
pnpm --filter @latte-js/art type-check
pnpm --filter @latte-js/art build
```

## License

`AGPL-3.0-or-later`, with commercial licensing available for the core/product edition.
