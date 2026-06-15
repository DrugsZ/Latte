# @latte-js/milk

React UI components and panels for Latte.

## Responsibility

- Provide reusable UI components and editor panels.
- Read projection/session state through runtime services and hooks.
- Trigger user intent through commands or service facades.

## Boundaries

- Must not write the document model directly.
- Must not own worker, history or low-level data structures.
- UI state may live here or in workbench services, but document state belongs to Espresso/Barista.

## Development

```bash
pnpm --filter @latte-js/milk type-check
pnpm --filter @latte-js/milk build
```

## License

`MIT`.
