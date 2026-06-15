# Latte Apps

This directory contains demo applications and product integrations for the Latte monorepo.

## Current App

| App    | Purpose                                                                                           | Package          |
| ------ | ------------------------------------------------------------------------------------------------- | ---------------- |
| `cafe` | Integration demo and smoke target for the editor runtime, renderer, worker pipeline and UI shell. | `@latte-js/cafe` |

Applications in this directory are not published as reusable packages. Shared code should live in `packages/*`.

## Development

From the repository root:

```bash
pnpm install
pnpm build
pnpm dev
```

Open `http://localhost:5173`.

Useful app checks:

```bash
pnpm --filter @latte-js/cafe build
pnpm e2e
```

## SharedArrayBuffer Requirement

Latte depends on `SharedArrayBuffer`. Local previews and deployments must send COOP/COEP headers so the page is cross-origin isolated. The `cafe` Vite config is the reference setup for local development.

## Contributing

See [../CONTRIBUTING.md](../CONTRIBUTING.md). App code should assemble packages and demonstrate workflows; it should not become the source of core engine behavior.

## License

Applications in this directory are demos and product integrations. `apps/cafe` is `UNLICENSED` and private; package-level licenses live in each package under `packages/*`.
