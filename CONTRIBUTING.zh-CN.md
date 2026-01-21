# Latte 贡献指南

首先，感谢您愿意为 Latte 贡献代码！🎉

Latte 是一个架构独特的复杂图形引擎。为了保持高性能和可扩展性，我们遵循严格的 **面向数据设计 (DOD)** 原则。

在编写代码之前，请务必仔细阅读本指南。违反架构规则的代码将无法合并。

---

## 目录

1. [环境搭建](#-环境搭建)
2. [架构宪法](#-架构宪法)
3. [开发工作流](#-开发工作流)
4. [测试策略](#-测试策略)
5. [反馈问题](#-反馈问题)
6. [Pull Request 规范](#-pull-request-规范)
7. [项目结构](#-项目结构)

---

## 🏗 环境搭建

我们使用 **pnpm** 工作区和 **Turborepo**。

```bash
# 1. 安装依赖
pnpm install

# 2. 构建所有包
pnpm build

# 3. 启动编辑器 (开发模式)
pnpm dev
```

---

## 📐 架构宪法

Latte **不是** 一个普通的 React 应用。为了性能，请务必遵守以下规则：

### 1. 依赖法则 (The Law of Dependency)

依赖关系必须**单向向下**流动。严禁循环依赖。

- ✅ `milk` -> `counter` -> `syrup` -> `barista` -> `espresso` -> `bean`
- ❌ `espresso` 不能引用 `milk`.
- ❌ `bean` 不能引用任何包.

### 2. 数据法则 (`@latte-js/espresso`)

- **禁止对象**: 严禁在内核中使用 JS 对象存储状态 (如 `{x: 10}`）。必须使用 `TypedArray` 索引。
- **禁止类存入 Buffer**: `SharedArrayBuffer` 只能存纯数字。
- **使用游标**: 业务逻辑必须通过 `NodeCursor` 读写数据。直接操作 Buffer 仅限于底层的 `Ops` 函数。

### 3. 渲染法则 (`@latte-js/art`)

- **只读**: 渲染器 **严禁** 修改业务数据。
- **无 React**: 严禁在渲染循环逻辑中使用 React 组件。
- **性能**: 必须使用 WorldMatrix 进行扁平化渲染。必须使用 AABB 进行视口剔除。

### 4. 变更法则 (The Law of Mutation)

- **单一真理来源**: 所有的写操作必须经过 `NodeCursor`，以触发：
  1.  脏标记 (Dirty Flags - 给渲染器)
  2.  观察者 (Observers - 给历史记录/协同)
- **事务**: 复杂操作必须包裹在 `history.startTransaction` 中。

---

## 🛠 开发工作流

### 示例：添加一个新功能 ("圆形工具")

1.  **定义类型 (`bean`)**: 在 `NodeType` 枚举中添加 `ELLIPSE`。
2.  **更新内核 (`espresso`)**: 确保 `Allocator` 和 `Serializer` 能正确处理该类型。
3.  **实现渲染 (`art`)**: 在 `RendererRegistry` 中注册圆形的绘制逻辑 (`ctx.ellipse`)。
4.  **实现逻辑 (`counter`)**:
    - 创建 `CircleTool` 继承自 `BaseTool`。
    - 注册命令: `latte.tool.circle`.
    - 处理拖拽事件，并通过 RPC 通知引擎更新数据。
5.  **更新 UI (`milk`)**: 在工具栏组件中添加圆形图标，绑定命令。

---

## 🧪 测试策略

- **单元测试 (`vitest`)**:
  - **必须**: 对 `espresso` (内存完整性) 和 `barista` (数学逻辑) 进行覆盖。
  - 运行: `pnpm test`
- **E2E 测试 (`playwright`)**:
  - **必须**: 对 `art` 进行视觉回归测试 (Visual Regression)。
  - 运行: `pnpm e2e`

---

## 🐛 反馈问题

### 报告 Bug

1.  **搜索**: 请先搜索 Issue 列表，确认该问题是否已被汇报。
2.  **清晰**: 提供清晰且描述性的标题。
3.  **细节**: 包含尽可能多的信息（Latte 版本、操作系统、复现步骤）。

### 功能建议

1.  **搜索**: 确认该建议是否已被提出。
2.  **解释**: 说明该功能的价值以及预期的工作方式。

---

## 🔀 Pull Request 规范

1.  **Fork** 仓库到您的账号。
2.  **创建分支** 用于您的功能或修复。
3.  **提交代码**: 遵循 **Conventional Commits** 规范 (例如: `feat: add circle tool`, `fix: memory leak`)。
4.  **编写测试**: 确保您的更改通过了测试。
5.  **Rebase**: 提交前请基于最新的 `main` 分支进行 Rebase。
6.  **签署工作**: 所有贡献都需要签署。这证明您编写了补丁或有权将其贡献给项目。

---

## 📦 项目结构速查

```text
packages/
├── bean/         # 字典 (Types)
├── espresso/     # 数据库 (Data Kernel)
├── barista/      # 引擎/工人 (The Worker)
├── art/          # 画家 (Renderer)
├── syrup/        # 操作系统 (Infra)
├── counter/      # 应用程序 (Business Logic)
└── milk/         # 皮肤 (React UI)
```

**需要帮助？** 如果您遇到困难，请创建 Draft PR 或在 [Discussions](https://github.com/DrugsZ/Latte/discussions) 页面提问。

感谢您的贡献！
