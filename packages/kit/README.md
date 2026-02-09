# @latte-js/kit (The Toolkit)

**The Barista's Toolkit.**
General-purpose runtime infrastructure library underpins the entire Latte Engine. It allows upper layers to focus on business logic rather than re-inventing wheels.

## Core Utilities

- **Event System**: VSCode-style, strongly-typed event system (`Emitter`) with read-write separation.
- **Lifecycle**: `Disposable` pattern and `DisposableStore` for automatic resource cleanup and memory leak prevention.
- **Data Structures**: Specialized high-performance structures like `LinkedList` used in critical paths.
- **Platform**: Environment detection (`isMacintosh`, `isWeb`) and standardized `KeyCode` definitions.
