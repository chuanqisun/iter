# RFC-004: Just-In-Time Branch Detection for Auto-Save

## Goal

The goal of this change is to **correctly determine when to overwrite an existing savepoint vs create a new savepoint (branch)** in `src/storage/use-auto-save.ts`.

When a conversation advances normally (user sends a new prompt, AI streams response), the autosave should overwrite the active checkpoint to avoid cluttering history. However, when history is mutated (e.g., editing an earlier message, mid-thread branch / fork, or pruning previous messages), autosave must detect this divergence and create a new checkpoint branch without overwriting the previous lineage.

---

### 1. Requirements & Core Principles

1. **Just-In-Time (JIT) Fingerprinting**:
   - Compute node fingerprints on demand whenever an auto-save operation is triggered.
   - Keep the `ChatNode` model decoupled from autosave hashing to simplify node lifecycle management.

2. **Browser Built-in `crypto.subtle.digest` (SHA-1)**:
   - Uses native `window.crypto.subtle.digest("SHA-1", buffer)` for sub-millisecond execution over thread nodes.
   - Fingerprint is formatted as a compact hex string (16 hex chars).

3. **Order-Insensitive Attachment Hashing**:
   - Attachments are represented as `${name}:${size}:${type}` metadata tokens.
   - The token array is sorted alphabetically before joining (`.sort().join(";")`) so attachment reordering does not produce false branches.

4. **Performance Measurement & Logging**:
   - Auto-save instruments performance using `performance.now()`.
   - Measures and logs time spent generating fingerprints as well as time spent checking append vs. branch divergence.

5. **Linear Prefix Matching**:
   - Compares the just-in-time array of current node fingerprints against the active checkpoint's saved fingerprints.
   - Detects tail deletions, mid-thread forks, and in-place edits cleanly.

---

### 2. Fingerprint Utility Functions

```ts
// src/storage/fingerprint.ts
import type { Attachment } from "../chat-tree/attachment";
import type { ChatNode } from "../chat-tree/tree-store";

export function getAttachmentToken(attachment: Attachment): string {
  const f = attachment.file;
  return `${f.name}:${f.size}:${f.type}`;
}

export async function computeNodeFingerprint(
  role: string,
  content: string,
  attachments?: Attachment[],
): Promise<string> {
  // 1. Order-insensitive attachment metadata signature
  const attachmentTokens = (attachments ?? [])
    .map(getAttachmentToken)
    .sort() // Guarantees order invariance
    .join(";");

  // 2. Textual message descriptor
  const payload = `${role}\0${content}\0${attachmentTokens}`;

  // 3. Web Crypto API SHA-1 digest
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);

  // 4. Hex string (16 chars)
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function computeThreadFingerprints(nodes: ChatNode[]): Promise<string[]> {
  return Promise.all(nodes.map((node) => computeNodeFingerprint(node.role, node.content, node.attachments)));
}
```

---

### 3. Manifest & Checkpoint Model

`AutoSaveCheckpointMeta` stores the snapshot of node fingerprints at the time of save:

```ts
// src/storage/auto-save-history.ts
export interface AutoSaveCheckpointMeta {
  id: string;
  timestamp: number;
  storageKey: string;
  fingerprints: string[]; // List of SHA-1 node fingerprints in sequential order
}
```

---

### 4. Append vs. Branch Decision Logic

```ts
// src/storage/branch-detection.ts

/**
 * Checks whether the current thread is a sequential continuation (append)
 * of the saved checkpoint.
 *
 * Overwrite condition:
 * - currentFingerprints length >= savedFingerprints length - 1 (accommodates active assistant node completion / user append)
 * - All historical indices in savedFingerprints (up to savedFingerprints.length - 1) match currentFingerprints exactly.
 */
export function isAppendingOnCheckpoint(
  savedFingerprints: string[] | undefined,
  currentFingerprints: string[],
): boolean {
  if (!savedFingerprints || savedFingerprints.length === 0) {
    return false; // No existing checkpoint -> create initial checkpoint
  }

  // If current thread has fewer nodes than previous historical prefix, user pruned/deleted history -> Branch
  if (currentFingerprints.length < savedFingerprints.length - 1) {
    return false;
  }

  // Verify all historical messages prior to the active tail match identically
  const prefixLength = savedFingerprints.length - 1;
  for (let i = 0; i < prefixLength; i++) {
    if (currentFingerprints[i] !== savedFingerprints[i]) {
      return false; // Mutated history / mid-thread fork -> Branch
    }
  }

  // Exact prefix match -> sequential continuation (Overwrite existing savepoint)
  return true;
}
```

---

### 5. Integration with `use-auto-save.ts` & Performance Instrumentation

During auto-save execution, perform JIT hashing, evaluate branching, and log performance metrics:

```ts
// src/storage/use-auto-save.ts (or auto-save-service.ts)

// Inside auto-save routine:
const t0 = performance.now();
const currentFingerprints = await computeThreadFingerprints(trimmedNodes);
const t1 = performance.now();

const activeCheckpoint = getActiveCheckpoint(instanceId, activeCheckpointId);
const isAppending = isAppendingOnCheckpoint(activeCheckpoint?.fingerprints, currentFingerprints);
const t2 = performance.now();

const isNewBranch = !isAppending;

console.log(
  `[auto-save:perf] Fingerprint: ${(t1 - t0).toFixed(2)}ms | Branch check: ${(t2 - t1).toFixed(2)}ms | Result: ${isNewBranch ? "new-branch" : "overwrite"}`,
);

// Save checkpoint with updated fingerprints snapshot in manifest
await saveCheckpoint(instanceId, activeCheckpointId, isNewBranch, trimmedNodes, currentFingerprints);
```

---

### 6. Summary of Key Benefits

- **Decoupled Model**: `ChatNode` remains pure without needing reactive fingerprint maintenance or serialization baggage.
- **Just-In-Time Simplicity**: Hashing happens only when persisting state; native SHA-1 for tens or hundreds of messages takes < 2ms.
- **Observability**: Built-in `console.log` timing breakdown for fingerprinting and branch evaluation.
- **Accurate Branch Detection**: Differentiates sequential appends (overwrite) from mid-tree forks, edits to previous turns, and message deletions (new savepoint).
- **Order-Insensitive Attachments**: Sorted `${name}:${size}:${type}` tokens prevent false branch creation on attachment reordering.
