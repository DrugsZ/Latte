# @latte-js/espresso (The Base)

**The Kernel: In-Memory Database.**
The foundation of the engine. Manages the scene graph using `SharedArrayBuffer` for high-performance data sharing between threads.

## Responsibilities

- **Data Structure**: Manages the LCRS (Left-Child Right-Sibling) tree structure.
- **Memory Management**: Handles SoA (Structure of Arrays) layout for cache efficiency.
- **Direct Access**: Provides typed views (Float32Array, etc.) into the shared memory.
