# @latte-js/milk (Steamed Milk)

**The User Interface.**
Provides all React UI components and Hooks for the editor.

## Contents

- **Components**: Primitives like `Button`, `Input`, `Dropdown`.
- **Panels**: `PropertiesPanel`, `LayerTree`, `Toolbar`.
- **Hooks**:
  - `useNode(id)`: Subscribe to kernel data changes.
  - `useSelection()`: Subscribe to selection changes.

## Architecture Principles

- **View Only**: Directly modifying data is prohibited. Components must trigger changes via `commands.execute`.
