# @latte-js/bean

Protocol and type contracts for Latte.

## Responsibility

- Define shared TypeScript types and enums.
- Define file schema types and RPC contract types.
- Provide dependency-light contracts used by main thread, worker, renderer and future plugins.

## Boundaries

- No runtime engine logic.
- No UI, worker host, renderer, service implementation or data storage.
- Keep dependencies minimal so downstream SDK/plugin packages can depend on it safely.

## Development

```bash
pnpm --filter @latte-js/bean type-check
pnpm --filter @latte-js/bean build
```

## License

`MIT`.
