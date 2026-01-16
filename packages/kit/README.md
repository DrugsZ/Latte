# @latte-js/kit (The Toolkit)

**The Barista's Toolkit.**
General-purpose runtime infrastructure library. Includes event systems, lifecycle management, asynchronous primitives, and more.

> This package is the foundational cornerstone of the Latte engine, depended upon by all upper-level packages including `espresso`, `barista`, `art`, and `syrup`.

## 📦 Features

### 1. Event System (VSCode Style)

Implements a strongly-typed event system with **read-write separation**, avoiding the common pitfalls and chaos associated with traditional `EventEmitter`.

```typescript
import { Emitter } from '@latte-js/kit';

const onDidNameChange = new Emitter<string>();
const event = onDidNameChange.event;

// Subscribe (Read-only interface)
event((name) => {
  console.log(`Name changed to: ${name}`);
});

// Trigger (Only the holder of the Emitter can fire events)
onDidNameChange.fire('Latte');
```
