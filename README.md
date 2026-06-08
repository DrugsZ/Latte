# Latte Engine

<p align="center">
  <strong>A programmable graphics editor engine for the web.</strong><br>
  <em>Figma-class canvas semantics · VSCode-style extensibility · Worker-first architecture</em>
</p>

<p align="center">
  <a href="./README.zh-CN.md">Chinese</a> ·
  <a href="./docs/roadmap.zh-CN.md">RoadMap</a> ·
  <a href="./docs/architecture-blueprint.zh-CN.md">Architecture</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a>
</p>

## Status

Latte is pre-1.0. The current work focuses on the editor kernel: shared memory data layout, worker-side mutation authority, read-only rendering projection, transform math, transaction/history boundaries, and open-source project governance.

## Vision

Latte aims to become a design-editor platform that combines:

- Figma-like canvas editing: high-performance layers, transforms, layout, components, variables, inspect and export.
- VSCode-like platform architecture: services, commands, keybindings, context keys, contribution points, configuration and plugin runtime.
- Future native performance runway: Rust/WASM kernels may provide hot geometry, storage, snapshot/diff and replay work behind the same worker/service boundaries.
- Commercial-friendly open source: package-level licenses, with core/product packages protected by AGPL plus commercial licensing and protocol/SDK packages kept permissive.

## Architecture

Latte uses a pnpm/Turborepo monorepo and a worker-first editing model:

```text
UI / Tool / Command / Plugin
  -> main-thread service facade
  -> RPC
  -> worker service
  -> MutationGate
  -> System / Manager
  -> NodeCursor
  -> SharedArrayBuffer / SoA
  -> renderer and UI readonly projection
```

| Package              | Role                    | Responsibility                                                                              |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `@latte-js/bean`     | Protocol                | Types, node enums, file schema types and RPC contracts.                                     |
| `@latte-js/espresso` | Data kernel             | `SharedArrayBuffer`, SoA layout, SceneGraph, NodeCursor, loader/serializer and temporary shared heap/blob storage. |
| `@latte-js/barista`  | Worker engine           | Worker services, systems, mutation policy, transactions, history, undo/redo and future Rust/WASM compute bridge. |
| `@latte-js/crema`    | Runtime assembly        | Editor runtime, worker client, projection sync and interaction controller.                  |
| `@latte-js/art`      | Rendering               | Read-only renderer, camera, hit testing, RTree and render backends.                         |
| `@latte-js/syrup`    | Main-thread platform    | Editor host, DI, commands, menus, keybindings, input and future contribution registry.      |
| `@latte-js/counter`  | Workbench contributions | Built-in tools, selection, commands and product behavior.                                   |
| `@latte-js/milk`     | UI                      | React panels and UI components that operate through services.                               |
| `@latte-js/kit`      | Utilities               | Events, lifecycle helpers, platform utilities and shared data structures.                   |
| `apps/cafe`          | Demo app                | Integration demo, local smoke target and product playground.                                |

## Getting Started

### Requirements

- Node.js >= 18
- pnpm 10.x, matching the `packageManager` field in `package.json`

### Install and Run

```bash
git clone https://github.com/DrugsZ/Latte.git
cd Latte
pnpm install
pnpm build
pnpm dev
```

Open `http://localhost:5173`.

### Common Commands

```bash
pnpm release:check
```

`pnpm release:check` runs the local release gate: license metadata, lint, type-check, unit tests, `apps/cafe` build, Playwright browser setup, smoke/e2e and `git diff --check`.

## RoadMap

See the detailed plan in [docs/roadmap.zh-CN.md](./docs/roadmap.zh-CN.md).

- P0: stabilize the kernel, projection, transform, history boundaries and release gates.
- P1: complete projection consistency, shared metadata, style/node/query services and structural history.
- P2: implement Figma-aligned geometry and layout semantics: constraints, auto layout and group auto-bounds.
- P3: build VSCode-style platform features: context keys, configuration, contribution registry and plugin manifest.
- P4: add design semantics: components, instances, variants, variables, styles, text/vector and libraries.
- P5: introduce extension host, public plugin API, permissions and runtime validation.
- P6: add Dev Mode, inspect, codegen, export and headless automation.
- P7: evolve collaboration, version history, production deployment and performance baselines.
- P8: evaluate Rust/WASM native kernels for proven hot storage and geometry paths.

## Documentation

- [Architecture blueprint](./docs/architecture-blueprint.zh-CN.md)
- [Detailed RoadMap](./docs/roadmap.zh-CN.md)
- [Figma layout and resize plan](./docs/figma-layout-resize-plan.zh-CN.md)
- [Governance and licensing](./docs/governance-and-licensing.zh-CN.md)
- [Contributing](./CONTRIBUTING.md)

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. The most important architectural rule is that document model writes must go through worker-side services/systems and `NodeCursor`; renderers and UI code read projections and do not mutate the model directly.

## License

This monorepo uses package-level licenses. Check each package's `package.json` and `LICENSE` before redistribution.

| Area                           | Packages                                         | License                                                  |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------- |
| Core/product packages          | `espresso`, `barista`, `crema`, `art`, `counter` | `AGPL-3.0-or-later`, with commercial licensing available |
| Protocol/SDK/UI infrastructure | `bean`, `kit`, `syrup`, `milk`                   | `MIT`                                                    |
| Demo applications              | `apps/cafe`                                      | `UNLICENSED`, not published as reusable packages         |

For commercial usage without AGPL obligations, contact the maintainers for a commercial license.
