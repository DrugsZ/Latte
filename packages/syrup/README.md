# @latte-js/syrup

Main-thread platform infrastructure for Latte.

## Responsibility

- Editor host scope and document shell for one editor instance.
- Dependency injection, service collection and instantiation foundations.
- Command, menu, keybinding, context menu and input services.
- Future context key, configuration and contribution registry foundations.

## Boundaries

- Platform infrastructure only; product tools belong in `@latte-js/counter`.
- `EditorHost` is an instance scope, not a runtime composition root or public plugin API.
- Does not own document model writes.
- Future public plugin API should expose a stable facade rather than raw internal service instances.

## Development

```bash
pnpm --filter @latte-js/syrup type-check
pnpm --filter @latte-js/syrup build
```

## License

`MIT`.
