# ☕️ Latte 引擎

<p align="center">
  <strong>面向未来的 Web 可编程图形引擎。</strong><br>
  <em>Figma 的极致性能 · VSCode 的极致扩展 · 原生无头架构</em>
</p>

<p align="center">
  <a href="./README.md">🇺🇸 English</a> •
  <a href="#-架构设计-咖啡全家桶">架构设计</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="./CONTRIBUTING.zh-CN.md">贡献指南</a>
</p>

---

## 🚀 愿景 (Vision)

**Latte** 不仅仅是另一个 Canvas 绘图库。它是为 AI 时代设计的**图形基础设施**。

Figma 是为*设计师*打造的，而 Latte 是为**开发者**打造的。它旨在解决传统 DOM/SVG 编辑器的性能瓶颈，同时提供一套“设计即代码 (Design-as-Code)”的 API 界面。

### 核心特性

- **⚡️ 工业级性能**: 基于 `SharedArrayBuffer`、**面向数据设计 (DOD)** 和 **Web Workers** 构建。支持 **10万+** 图层在 60 FPS 下流畅操作。
- **🤖 无头模式 (Headless)**: 核心引擎可完全脱离浏览器，在 Node.js 中运行。完美支持服务端图片生成、AI 自动布局 Agent 以及自动化测试。
- **🔌 一切皆插件**: 采用 VSCode 的扩展模型。即使是核心功能（如“矩形工具”或“自动布局”）也仅仅是内置插件。
- **🛡️ 数据主权**: 支持私有化部署 (Self-hosted)。您的设计数据永远在您自己的服务器上。

---

## 🏛 架构设计 (咖啡全家桶)

Latte 采用严格的 Monorepo 结构，由 **Turborepo** 管理。包命名沿用“咖啡主题”隐喻：

| 包名 (Package)           | 角色       | 隐喻说明                                                                               |
| :----------------------- | :--------- | :------------------------------------------------------------------------------------- |
| **`@latte-js/bean`**     | **协议层** | **咖啡豆**。纯类型定义、JSON 结构、RPC 协议。无运行时依赖，是一切的原材料。            |
| **`@latte-js/espresso`** | **内核层** | **浓缩基底**。基于 `SharedArrayBuffer` 的内存数据库。管理 SoA 内存布局与 LCRS 树结构。 |
| **`@latte-js/barista`**  | **引擎层** | **咖啡师**。逻辑调度与计算中心。负责自动布局、吸附计算。通常运行在 **Web Worker** 中。 |
| **`@latte-js/art`**      | **渲染层** | **拉花**。视觉呈现。读取 _Espresso_ 数据并绘制到 Canvas/WebGL。负责高性能点击检测。    |
| **`@latte-js/syrup`**    | **基建层** | **糖浆**。微内核基础设施。管理命令系统、快捷键服务、插件沙箱。                         |
| **`@latte-js/counter`**  | **业务层** | **吧台**。内置的业务逻辑与工具集（如选择工具、对齐命令）。_(原 Workbench)_             |
| **`@latte-js/cup`**      | **组件库** | **杯子**。无业务逻辑的 Headless UI 组件库（输入框、按钮）。                            |
| **`@latte-js/milk`**     | **UI 层**  | **牛奶**。React 业务组件（属性面板、图层树）。仅作为数据的投影。                       |

---

## 🛠 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **pnpm**: >= 9.0.0

### 安装运行

```bash
# 1. 克隆仓库
git clone https://github.com/DrugsZ/Latte.git
cd Latte

# 2. 安装依赖
pnpm install

# 3. 构建核心包
pnpm build

# 4. 启动编辑器 (开发模式)
pnpm dev
```

访问 `http://localhost:5173` 开始体验。

---

## 🗺 路线图 (Roadmap)

- [ ] **Phase 1: 创世纪 (Genesis)** - 共享内存架构与数据加载器。
- [ ] **Phase 2: 可视化 (Visualization)** - Canvas 渲染器与 React 桥接。
- [ ] **Phase 3: 交互 (Interaction)** - 命令系统、选择与变换工具。
- [ ] **Phase 4: 进化 (Evolution)** - 计算逻辑 Worker 化与 Rust/Wasm 集成。
- [ ] **Phase 5: 生态 (Ecosystem)** - 插件 API 与市场。

---

## 📄 许可证 (License)

- **核心引擎** (`espresso`, `barista`, `art`): **AGPL-3.0** (开源，强传染性)。
- **生态组件** (`bean`, `cup`, `syrup`): **MIT** (宽松协议)。

_如果您希望在不开源您代码的情况下将 Latte 用于商业产品（如 SaaS、内部工具），请联系我们购买 **商业授权 (Commercial License)**。_
