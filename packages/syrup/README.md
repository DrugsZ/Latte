# @latte-js/syrup (Flavor Syrup)

**The Microkernel & Plugin Base.**
Similar to VSCode's core service layer, managing commands, keybindings, and lifecycles.

## Core Services

- **CommandRegistry**: Global command registry (`latte.commands.register`).
- **KeybindingService**: Shortcut listening and context dispatching.
- **ContextKeyService**: Manages context state (e.g., `isCanvasFocused`).
- **ExtensionHost**: Sandbox for running third-party plugins.
