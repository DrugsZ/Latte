# @latte-js/crema

Editor runtime assembly for Latte applications.

## Responsibility

- Create and wire the main-thread editor runtime.
- Start and connect the Barista worker client.
- Register local and RPC-backed services.
- Coordinate projection sync between worker-owned data and main-thread read-only consumers.
- Coordinate high-frequency interactions through runtime controllers.

## Boundaries

- Does not implement product tools directly; those belong in `@latte-js/counter`.
- Does not implement low-level data structures; those belong in `@latte-js/espresso`.
- Does not expose the long-term public plugin API; future plugin facade should be a stable package above internal services.

## Development

```bash
pnpm --filter @latte-js/crema type-check
pnpm --filter @latte-js/crema test
pnpm --filter @latte-js/crema build
```

## License

`AGPL-3.0-or-later`, with commercial licensing available for the core/product edition.
