### 1. Requirements & Core Principles

1. **Amortized On-Edit Calculation**:
   - Compute each node's SHA-1 fingerprint asynchronously as the user edits content or modifies attachments.
   - Store the computed fingerprint on the node (`node.fingerprint`).
   - At submission time, the fingerprints of all historical nodes are already available in memory ($O(1)$ lookup per node, $0\text{ ms}$ submit overhead).

2. **Browser Built-in `crypto.subtle.digest` (SHA-1)**:
   - Uses native `window.crypto.subtle.digest("SHA-1", buffer)`.
   - Truncated or formatted as a hex string (e.g. 8–16 characters or 40-char full hex).

3. **Order-Insensitive Attachment Hashing**:
   - Attachments represented as `${name}:${size}:${type}` metadata tokens.
   - The token array is sorted alphabetically before joining (`.sort().join(";")`) so attachment reordering does not produce false branches.

4. **Linear Prefix Matching at Submission**:
   - Compares the pre-computed array of fingerprints against the active checkpoint's saved fingerprints.
   - Detects tail deletions, mid-thread forks, and in-place edits cleanly.

---

### 2. Fingerprint Utility Function

```ts
// src/chat-tree/fingerprint.ts (or src/storage/fingerprint.ts)

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

  // 4. Hex string (e.g. 16 chars or 40 chars)
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
```

---

### 3. On-Edit Lifecycle & Tree Store Integration

#### A. Node Model Update

Add `fingerprint?: string` to `ChatNode`:

```ts
export interface ChatNode {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  fingerprint?: string; // Precomputed SHA-1 fingerprint
  // ...other fields
}
```

#### B. Asynchronous Fingerprint Resolution on Changes

Whenever a node is created or modified:

1. **On Node Edit / Content Change / Blur**:
   - Trigger `computeNodeFingerprint(node.role, node.content, node.attachments)` asynchronously.
   - Assign the result to `node.fingerprint`.
2. **On Attachment Add / Remove / Replace**:
   - Recompute and update `node.fingerprint`.
3. **On AI Stream Completion**:
   - Compute fingerprint once when streaming writer closes.
4. **On Restoring Checkpoint**:
   - Restored nodes can either carry their fingerprints or compute them in a single batch during hydration.

---

### 4. Manifest & Checkpoint Model

`AutoSaveCheckpointMeta` stores the snapshot of node fingerprints at the time of save:

```ts
export interface AutoSaveCheckpointMeta {
  id: string;
  timestamp: number;
  storageKey: string;
  fingerprints: string[]; // List of SHA-1 node fingerprints in order
}
```

---

### 5. Append vs. Branch Decision (Zero-Cost on Submit)

When the user submits a message at `activeUserNodeIndex`:

```ts
export function isAppendingOnCheckpoint(
  savedFingerprints: string[] | undefined,
  currentNodes: ChatNode[],
  submittedNodeIndex: number,
): boolean {
  if (!savedFingerprints || savedFingerprints.length === 0) {
    return false; // No existing checkpoint -> create initial
  }

  // 1. If user deleted messages, active index is before the saved checkpoint's tail
  if (submittedNodeIndex < savedFingerprints.length - 1) {
    return false; // User pruned history -> create new checkpoint
  }

  // 2. Verify all historical messages match identically
  for (let i = 0; i < savedFingerprints.length - 1; i++) {
    const nodeFp = currentNodes[i].fingerprint;
    // If any prior message was edited, fingerprint won't match
    if (!nodeFp || nodeFp !== savedFingerprints[i]) {
      return false; // Mutated history -> create new checkpoint
    }
  }

  // Exact prefix match and appending from or beyond tail -> Overwrite existing checkpoint
  return true;
}
```

---

### 6. Summary of Key Benefits

- **Amortized computation**: SHA-1 hashing happens on idle/edit moments; zero latency during the user's submit action.
- **Fast native hashing**: Uses `crypto.subtle.digest("SHA-1")` directly supported in all modern browsers.
- **No binary image hashing**: Uses sorted `name:size:type` tokens, keeping image attachment processing instant.
- **Order-insensitive**: Dragging, reordering, or reorganizing attachments does not trigger unnecessary branches.
- **Edge cases covered**: Handles tail deletions, previous message edits, mid-thread forks, and regular tail appends precisely.
