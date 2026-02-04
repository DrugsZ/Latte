# @latte-js/barista (The Barista)

**The Brain: Time & Process Management.**
Responsible for heavy computations, auto-layout, and Web Worker management.

## Responsibilities

- **Scheduler**: Implements Time Slicing to prevent blocking the main thread.
- **Systems**: Includes `LayoutSystem` (Auto Layout) and `PhysicsSystem` (Snapping).
- **Worker**: Manages Web Worker lifecycle and task distribution.

## Core Logic

- **Resize Calculations**: Performs matrix transformations and constraint propagation in parallel within the Worker.
