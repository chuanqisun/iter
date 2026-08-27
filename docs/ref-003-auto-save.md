# Outline

- Goal
  - prevent data loss due to (1) accidental close of window, and (2) accidental regeneration of earlier message in the thread
- Timing
  - auto-save performed at non-distruptive moments: (1) after user submits a request and (2) after AI finishes responding. The former fills network waiting time, the latter fills user's reaction time.
  - Do NOT trigger auto-save on empty thread. When user opens the app and reloads a few times, nothing should be saved.
  - After restoring a save point, do NOT auto-save the newly restored state until user submits or AI finishes responding.
- User experience
  - Saving is performed in the background, no visual indication
  - Recovery is performed via a "Restore" button and a dialog for picking the save point
- Data modeling
  - Each app instance has a unique id. This maps to each tab/window in the browser where app script runs
  - Each app instance has a history save points. We preserve the most recent K (=10 by default) save points per app instance
  - We preserve the most recent P (=10 by default) app instances. Newer changes would bump the instance to a higher position on the list
  - The window/tab identity is immutable. Opening a new tab/window creates a new instance, and restoring a closed tab/window means copying the state into the new instance.
- Data recovery
  - When user open the app, the initial state is always empty, with two input areas, one for system prompt, one for user prompt. When there is recovery data, we should display it below the bottom of the thread and remove it once the thread has any content in it.
  - The recovery area is just a single "Restore" button that opens a dialog.
  - The dialog is a master-detail pattern. Master is a list of app instances (newest first), and detail is the latest save point, with a "Prev" and "Next" button to navigate through the save points.
  - A "Load" button will copy the selected save point into the current app instance, and close the dialog. The user can then continue to work on the restored state.
  - Escape key should close the dialog. You can look into the current system menu and borrow its behavior.
- Storage
  - Use Indexed DB (via idb-keyval library) to store checkpoints as files. One file per save point. Consider reusing the existing export/import markup file format
- Testing
  - Carefully testing the auto-save and restore behavior (without DOM)
  - Handle various save/restore edge cases. Consider different sequencing, and limit handling.
  - Do NOT hard code limits in the test code. Do NOT implement business logic in the test code. Instead, import any parameters from the main code and only test behaviors.
- Refactoring
  - Implement the full feature, then refactor the code to reduce unnecessary duplication of logic, and ensure high readability and maintainability
  - Avoid commenting. Instead prefer self-evident naming. Comment is only needed for special hacks/workarounds
- Styling
  - Keep the styling consistent with current app

## Implementation plan

### 1. Storage Architecture & Data Modeling

#### 1.1 App Instance Identification

- Each browser window/tab generates an immutable `instanceId` (UUID) upon initialization.
- Opening a new window/tab creates a new `instanceId`. Restoring a checkpoint copies the saved state into the current `instanceId`.

#### 1.2 Storage Schema (via `idb-keyval`)

- **Configurable Limits (exported as constants):**
  - `MAX_CHECKPOINTS_PER_INSTANCE = 10` ($K$)
  - `MAX_INSTANCES = 10` ($P$)
- **Manifest (`iter.autosave.manifest`):**
  ```ts
  interface AutoSaveManifest {
    instances: AutoSaveInstanceSummary[];
  }

  interface AutoSaveInstanceSummary {
    instanceId: string;
    createdAt: number;
    updatedAt: number;
    checkpoints: AutoSaveCheckpointMeta[];
  }

  interface AutoSaveCheckpointMeta {
    id: string;
    timestamp: number;
    storageKey: string; // e.g. "iter.checkpoint.${instanceId}.${checkpointId}"
    previewSummary?: string;
  }
  ```
- **Checkpoint Files (`iter.checkpoint.${instanceId}.${checkpointId}`):**
  - Stored as raw HTML string formatted by `stringifyChat(nodes)`.

#### 1.3 Retention & Pruning Logic

- When a new checkpoint is written:
  1. Append checkpoint to the instance's checkpoint history.
  2. If checkpoints exceed $K$, remove the oldest checkpoints and delete their corresponding storage keys.
  3. Move current instance to the head of the instance list (newest first).
  4. If instances exceed $P$, remove the oldest instances and delete all their associated checkpoint storage keys.

#### 1.4 Empty Thread Guard

- A thread is considered empty (`isThreadEmpty`) if:
  - Total nodes $\le 2$ (system node + initial user node),
  - Content of all nodes is empty (`trim() === ""`),
  - No attachments exist on any node.
- No auto-save operation is ever triggered while a thread is empty.

---

### 2. File Change Sequence

#### Step 1: Storage Layer (`src/storage/auto-save.ts` - New File)

- Define and export constants: `DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE = 10`, `DEFAULT_MAX_INSTANCES = 10`.
- Implement standalone, pure storage management functions decoupled from DOM:
  - `isThreadEmpty(nodes: ChatNode[]): boolean`
  - `createCheckpoint(instanceId: string, nodes: ChatNode[], options?: { maxCheckpoints?: number; maxInstances?: number }): Promise<void>`
  - `listInstances(): Promise<AutoSaveInstanceSummary[]>`
  - `loadCheckpoint(storageKey: string): Promise<string | undefined>`
  - `deleteInstance(instanceId: string): Promise<void>`
  - `clearAllCheckpoints(): Promise<void>`
- Encapsulate `idb-keyval` read/write/delete operations and metadata maintenance.

#### Step 2: Unit Testing (`src/storage/auto-save.test.ts` - New File)

- Test without DOM dependencies using in-memory mock for `idb-keyval`.
- Test cases:
  - Auto-saving a non-empty thread creates manifest and storage entry.
  - Rejecting auto-save on empty thread.
  - Enforcing $K$ checkpoints limit per instance and verifying deletion of expired storage keys.
  - Enforcing $P$ instances limit and verifying cleanup of evicted instance checkpoints.
  - Ensuring newer updates bump an instance to the top of the list.
  - Retrieving and parsing saved checkpoint HTML content.
  - Importing $K$ and $P$ parameter constants directly from `auto-save.ts` without hardcoding in tests.

#### Step 3: React Hook (`src/storage/use-auto-save.ts` - New File)

- Create `useAutoSave` hook:
  - Generate and hold `instanceId` for the lifetime of the component/session.
  - Maintain `hasRecoveryData` boolean state (checking if any saved checkpoints exist in IndexedDB on mount).
  - Expose `saveCurrentState(nodes: ChatNode[]): Promise<void>`.
  - Expose `restoreCheckpoint(storageKey: string): Promise<ChatNode[]>`.
  - Track a flag `isRestoredState` to prevent triggering an immediate auto-save upon restoring until the user submits a new prompt or the AI completes a response.

#### Step 4: Restore Dialog Component & Styles

- **`src/chat-tree/restore-dialog.css` (New File):**
  - Styling for master-detail modal overlay, instance sidebar list, checkpoint navigation controls ("Prev", "Next", index indicator), content preview panel, and action footer ("Load", "Cancel").
- **`src/chat-tree/restore-dialog.tsx` (New File):**
  - Master-detail modal component:
    - Master view: List of saved app instances sorted newest first, showing timestamp, message preview, and checkpoint count.
    - Detail view: Checkpoint browser for selected instance, starting with the latest checkpoint. Includes "Prev" and "Next" buttons to traverse history, formatted timestamp, and preview of user/assistant messages.
    - Footer buttons: "Load" (loads selected checkpoint into active session and closes dialog) and "Cancel".
    - Keyboard accessibility: Listen for `Escape` key to close the dialog, matching the existing dialog conventions.

#### Step 5: Chat Tree Layout & Trigger Integration

- **`src/chat-tree/chat-tree.css` (Update):**
  - Add styling for the bottom recovery bar (the "Restore" button) displayed below empty initial thread inputs.
- **`src/chat-tree/chat-tree.tsx` (Update):**
  - Integrate `useAutoSave`.
  - Trigger `saveCurrentState` at two non-disruptive moments in `handleRunNode`:
    1. **After user submits request:** Immediately after appending user message & assistant placeholder to `treeNodes`.
    2. **After AI finishes responding:** Inside `try ... finally` block after stream completes or on stream completion/error.
  - Render the "Restore" button at the bottom of the thread when `isThreadEmpty(treeNodes)` is true and `hasRecoveryData` is true.
  - Render `RestoreDialog` when user clicks the "Restore" button.
  - When a checkpoint is loaded via the dialog, update `treeNodes` using `parseChat` and ensure no immediate save occurs until the next user submission or AI response.

---

### 3. Edge Cases & Verification Plan

- **Accidental Close / Reload:** Opening a new tab presents an empty thread with the "Restore" button; clicking it shows the most recent instance and its last checkpoint.
- **Branching / Regeneration:** Checkpoint history preserves intermediate save points, allowing recovery of earlier branches before regeneration.
- **Empty Thread Protection:** Reloading multiple times on an empty thread creates no phantom instances or empty checkpoints.
- **Storage Limit Robustness:** Heavy usage across tabs automatically evicts oldest checkpoints and instances without leaking storage.
