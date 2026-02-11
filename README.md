# ☕️ Latte Engine

<p align="center">
  <strong>The Programmable Graphics Engine for the Web.</strong><br>
  <em>Figma-class Performance · VSCode-class Extensibility · Headless Architecture</em>
</p>

<p align="center">
  <a href="./README.zh-CN.md">🇨🇳 中文文档</a> •
  <a href="#-architecture-the-coffee-stack">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="./CONTRIBUTING.md">Contributing</a>
</p>

---

## 🚀 Vision

**Latte** is not just another canvas library. It is a **graphics infrastructure** designed for the AI era.

While tools like Figma are built for _designers_, Latte is built for **developers**. It solves the performance bottlenecks of traditional DOM/SVG editors while offering a "Design-as-Code" API surface.

### Why Latte?

- **⚡️ Industrial Performance**: Built on `SharedArrayBuffer`, **Data-Oriented Design (DOD)**, and **Web Workers**. Capable of handling **100,000+** layers at 60 FPS.
- **🤖 Headless & Automation**: The core engine runs in Node.js without a browser. Perfect for server-side image generation, AI layout agents, and automated testing.
- **🔌 Everything is a Plugin**: Adopts the VSCode extension model. Core features like "Rect Tool" or "Auto Layout" are just built-in plugins.
- **🛡️ Data Sovereignty**: Self-hostable. Your data stays on your servers.

---

## 🏛 Architecture (The Coffee Stack)

Latte follows a strict Monorepo structure managed by **Turborepo**. The naming convention follows a "Coffee Theme":

| Package                  | Role         | Description                                                                                             |
| :----------------------- | :----------- | :------------------------------------------------------------------------------------------------------ |
| **`@latte-js/bean`**     | **Protocol** | **Coffee Beans.** Pure type definitions, JSON schemas, and RPC contracts. Zero runtime.                 |
| **`@latte-js/espresso`** | **Kernel**   | **The Base.** In-memory database using `SharedArrayBuffer`. Manages SoA layout and LCRS tree.           |
| **`@latte-js/barista`**  | **Engine**   | **The Barista.** Logic scheduler & calculation engine (Auto Layout, Physics). Runs in **Web Worker**.   |
| **`@latte-js/art`**      | **Render**   | **Latte Art.** Visualizer. Reads memory from _Espresso_ and draws to Canvas/WebGL. Handles Hit-testing. |
| **`@latte-js/syrup`**    | **Infra**    | **Flavor Syrup.** Microkernel infrastructure. Manages Commands, Keybindings, and Extension Host.        |
| **`@latte-js/counter`**  | **Logic**    | **The Counter.** Built-in business logic (Tools, Commands). (Formerly workbench)                        |
| **`@latte-js/cup`**      | **UI Kit**   | **The Cup.** Headless UI components (Inputs, Buttons) styled for high-density tools.                    |
| **`@latte-js/milk`**     | **View**     | **Steamed Milk.** React components that bind UI to Engine data (Properties Panel, Layer Tree).          |

---

## 🛠 Getting Started

### Prerequisites

- **Node.js**: >= 18.0.0
- **pnpm**: >= 9.0.0

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/DrugsZ/Latte.git
cd Latte

# 2. Install dependencies
pnpm install

# 3. Build core packages
pnpm build

# 4. Start the Editor (Dev mode)
pnpm dev
```

Open `http://localhost:5173` to start editing.

---

## 🗺 Roadmap

- [ ] **Phase 1: Genesis** - SharedMemory Architecture & Data Loader.
- [ ] **Phase 2: Visualization** - Canvas Renderer & React Bridge.
- [ ] **Phase 3: Interaction** - Command System, Selection & Transform Tools.
- [ ] **Phase 4: Evolution** - Worker Offloading & Rust/Wasm Integration.
- [ ] **Phase 5: Ecosystem** - Plugin API & Marketplace.

---

## 📄 License

- **Core Engine** (`espresso`, `barista`, `art`): **AGPL-3.0** (Open Source, Copyleft).
- **Ecosystem** (`bean`, `cup`, `syrup`): **MIT** (Permissive).

_For commercial usage without open-sourcing your code, please contact us for a **Commercial License**._
