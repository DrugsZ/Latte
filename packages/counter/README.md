# @latte-js/counter

Built-in workbench contributions for Latte.

## Responsibility

- Register built-in tools, commands and product behavior.
- Own main-thread session services such as selection and tool state.
- Bridge user intent from `@latte-js/syrup` platform services to runtime/domain services.

## Boundaries

- Does not own document model writes.
- Does not own undo/redo stacks; history lives in `@latte-js/barista`.
- Selection is UI/session state. Document mutations still go through service/RPC/worker paths.

## Development

```bash
pnpm --filter @latte-js/counter type-check
pnpm --filter @latte-js/counter build
```

## License

`AGPL-3.0-or-later`, with commercial licensing available for the core/product edition.
