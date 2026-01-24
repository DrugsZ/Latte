# Contributing to Latte

First off, thanks for taking the time to contribute! 🎉

Latte is a complex engineering project with a unique architecture. To maintain high performance and scalability, we follow strict **Data-Oriented Design (DOD)** principles.

Please read this guide carefully. Code that violates these rules will be rejected.

---

## Table of Contents

- [Contributing to Latte](#contributing-to-latte)
  - [Table of Contents](#table-of-contents)
  - [🏗 Monorepo Setup](#-monorepo-setup)
  - [📐 Architectural Constitution](#-architectural-constitution)
    - [1. The Law of Dependency](#1-the-law-of-dependency)
    - [2. The Law of Data (`@latte-js/espresso`)](#2-the-law-of-data-latte-jsespresso)
    - [3. The Law of Rendering (`@latte-js/art`)](#3-the-law-of-rendering-latte-jsart)
    - [4. The Law of Mutation](#4-the-law-of-mutation)
  - [🛠 Development Workflow](#-development-workflow)
    - [Example: Adding a New Feature ("Circle Tool")](#example-adding-a-new-feature-circle-tool)
  - [🧪 Testing Strategy](#-testing-strategy)
  - [🐛 Reporting Issues](#-reporting-issues)
    - [Bug Reports](#bug-reports)
    - [Feature Requests](#feature-requests)
  - [🔀 Pull Request Guidelines](#-pull-request-guidelines)
  - [📦 Project Structure](#-project-structure)

---

## 🏗 Monorepo Setup

We use **pnpm** workspaces and **Turborepo**.

```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages
pnpm build

# 3. Start the editor (Dev mode)
pnpm dev
```

---

## 📐 Architectural Constitution

Latte is **NOT** a standard React application. We enforce the following laws to ensure performance.

### 1. The Law of Dependency

Dependencies must flow **downwards**. Circular dependencies are strictly forbidden.

- ✅ `milk` -> `counter` -> `syrup` -> `barista` -> `espresso` -> `bean`
- ❌ `espresso` cannot import `milk`.
- ❌ `bean` cannot import anything.

### 2. The Law of Data (`@latte-js/espresso`)

- **No Objects**: Do not store state as JS objects in the kernel (e.g., `{x: 10}`). Use `TypedArray` indices.
- **No Classes in Buffer**: Data in `SharedArrayBuffer` must be flat numbers.
- **Use Cursors**: Business logic must use `NodeCursor` to read/write data. Direct buffer access is restricted to internal `Ops`.

### 3. The Law of Rendering (`@latte-js/art`)

- **Read-Only**: The renderer should **NEVER** modify business data.
- **No React**: Do not use React components inside the renderer logic.
- **Performance**: Always use WorldMatrix for flat rendering. Do not traverse the tree recursively if possible.

### 4. The Law of Mutation

- **Single Source of Truth**: All writes must go through `NodeCursor` to trigger:
  1.  Dirty Flags (for Renderer)
  2.  Observers (for History/Sync)
- **Transactions**: Complex operations must be wrapped in `history.startTransaction`.

---

## 🛠 Development Workflow

### Example: Adding a New Feature ("Circle Tool")

1.  **Define Type (`bean`)**: Add `ELLIPSE` to `NodeType` enum.
2.  **Update Kernel (`espresso`)**: Ensure `Allocator` and `Serializer` handle the new type.
3.  **Implement Rendering (`art`)**: Add drawing logic (`ctx.ellipse`) to the `RendererRegistry`.
4.  **Implement Logic (`counter`)**:
    - Create `CircleTool` extending `BaseTool`.
    - Register command: `latte.tool.circle`.
    - Handle drag events to update kernel data via RPC.
5.  **Update UI (`milk`)**: Add an icon to the toolbar component.

---

## 🧪 Testing Strategy

- **Unit Tests (`vitest`)**:
  - **Required** for `espresso` (memory integrity) and `barista` (math logic).
  - Run: `pnpm test`
- **E2E Tests (`playwright`)**:
  - **Required** for `art` (Visual Regression).
  - Run: `pnpm e2e`

---

## 🐛 Reporting Issues

### Bug Reports

1.  **Search**: Check if the issue has already been reported.
2.  **Be clear**: Provide a clear and descriptive title for the issue.
3.  **Include details**: Include as much information as possible, such as the version of Latte, your operating system, and steps to reproduce the issue.

### Feature Requests

1.  **Search**: Check if the enhancement has already been suggested.
2.  **Explain**: Explain why this enhancement would be useful and how it would work.

---

## 🔀 Pull Request Guidelines

1.  **Fork** the repository to your own GitHub account.
2.  **Create a branch** for your feature or fix.
3.  **Commit** your changes following the **Conventional Commits** specification (e.g., `feat: add circle tool`, `fix: memory leak in loader`).
4.  **Write tests** for your changes.
5.  **Rebase** your branch on the latest `main` before submitting.
6.  **Sign your work**: The sign-off is required. It certifies that you wrote the patch or have the right to contribute it.

---

## 📦 Project Structure

```text
packages/
├── bean/         # Types (The Dictionary)
├── espresso/     # Data (The Database)
├── barista/      # Engine (The Worker)
├── art/          # Render (The Painter)
├── syrup/        # Infra (The OS)
├── counter/      # Logic (The App)
└── milk/         # UI (The Skin)
```

**Need Help?** If you’re stuck, create a draft pull request or ask for help on the [Discussions](https://github.com/DrugsZ/Latte/discussions) page.
