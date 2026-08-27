# Outline

- Goal
  - prevent data loss due to (1) accidental close of window, and (2) accidental regeneration of earlier message in the thread
- Timing
  - auto-save performed at non-distruptive moments: (1) after user submits a request and (2) after AI finishes responding. The former fills network waiting time, the latter fills user's reaction time.
  - Do NOT trigger auto-save on empty thread. When user opens the app and reloads a few times, nothing should be saved.
  - After restoring a save point, do NOT auto-save the newly restored state until user submits or AI finishes responding.
- User experience
  - Saving is performed in the background, no visual indication or unnecessary component re-rendering
  - Recovery is performed via a "Restore" button and a dialog for picking the save point
- Data modeling
  - Each app instance has a unique id. This maps to each tab/window in the browser where app script runs
  - Each app instance has a history of save points. We preserve the most recent K (=10 by default) save points per app instance
  - We preserve the most recent P (=10 by default) app instances. Newer changes would bump the instance to a higher position on the list
  - Limits (K and P) may change over time without breaking existing data or format
  - The window/tab identity is immutable. Opening a new tab/window creates a new instance, and restoring a closed tab/window means copying the state into the new instance.
  - Checkpoints do NOT store a separate text summary; the UI simply displays the last two messages
- Data recovery
  - When user opens the app, the initial state is always empty, with two input areas, one for system prompt, one for user prompt. When there is recovery data, we should display it below the bottom of the thread and remove it once the thread has any content in it.
  - The recovery area is just a single "Restore" button that opens a dialog.
  - The dialog is a master-detail pattern. Master is a list of app instances (newest first), and detail is the latest save point, with "Prev" and "Next" buttons to navigate through the save points.
  - The detail view displays the last two messages of the selected save point.
  - A "Download" button in the dialog allows downloading the selected save point as its raw HTML file.
  - A "Load" button will copy the selected save point into the current app instance and close the dialog. The user can then continue to work on the restored state.
  - Escape key should close the dialog. You can look into the current system menu and borrow its behavior.
- Storage & Architecture
  - Modular separation into three distinct layers:
    1. **History Management**: In-memory data structures and algorithms managing instance lists, save points, ranking, and limit pruning without storage or UI dependencies.
    2. **Auto-Save**: Orchestrates timing, checks empty thread guard, serializes chat data to HTML, hydrates history, writes to Indexed DB (via `idb-keyval`), and cleans up deleted keys.
    3. **Restore**: Reads checkpoints/manifest from Indexed DB, extracts the last two messages for preview, enables raw HTML export, and populates the app.
- Testing
  - Carefully test history management, auto-save, restore, and pruning behavior (without DOM).
  - Explicitly unit test pruning algorithms (both instance-level and checkpoint-level key eviction and limit changes).
  - Do NOT hard code limits in the test code. Do NOT implement business logic in the test code. Instead, import parameters from the main code and test dynamic limit adaptations.
- Refactoring
  - Implement the full feature, then refactor the code to reduce unnecessary duplication of logic, and ensure high readability and maintainability.
  - Avoid commenting. Instead prefer self-evident naming. Comment is only needed for special hacks/workarounds.
- Styling
  - Keep the styling consistent with current app.

## Implementation plan

### 1. Architecture & Data Modeling

```
+-------------------------------------------------------------+
|                     React UI Layer                          |
|  - ChatTree (triggers save on submit / complete)            |
|  - Restore Button & RestoreDialog (master-detail UI)        |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                 useAutoSave Hook (React Adapter)            |
|  - Holds mutable instanceId & save locks via refs (no lag)  |
|  - Subscribes to recovery data availability                 |
|  - Exposes save/restore callbacks without re-renderings     |
+---------------+------------------------------+--------------+
                |                              |
                v                              v
+-------------------------------+ +---------------------------+
|       Auto-Save Engine        | |      Restore Engine       |
|  - Empty thread detection     | |  - Fetch checkpoint & list|
|  - stringifyChat serialization| |  - Extract last 2 msgs    |
|  - Coordinates IDB writes     | |  - parseChat & populate   |
|  - Removes pruned IDB keys    | |  - Download raw HTML file |
+---------------+---------------+ +-------------+-------------+
                |                               |
                +---------------+---------------+
                                |
                                v
+-------------------------------------------------------------+
|                 History Store (Pure Model)                  |
|  - AutoSaveManifest & Checkpoint data structures            |
|  - Pure functions: addCheckpoint, bumpInstance, prune       |
|  - Dynamic K and P limit adaptation & evicted keys list     |
+-------------------------------+-----------------------------+
                                |
                                v
+-------------------------------------------------------------+
|                   IndexedDB (`idb-keyval`)                  |
|  - iter.autosave.manifest                                   |
|  - iter.checkpoint.${instanceId}.${checkpointId} (raw HTML) |
+-------------------------------------------------------------+
```

#### 1.1 App Instance & History Model (`src/storage/auto-save-history.ts`)

- **Configurable Limits (exported with default values):**
  - `DEFAULT_MAX_CHECKPOINTS_PER_INSTANCE = 10` ($K$)
  - `DEFAULT_MAX_INSTANCES = 10` ($P$)
- **Data Structures:**
  ```ts
  export interface AutoSaveCheckpointMeta {
    id: string;
    timestamp: number;
    storageKey: string;
  }

  export interface AutoSaveInstanceSummary {
    instanceId: string;
    createdAt: number;
    updatedAt: number;
    checkpoints: AutoSaveCheckpointMeta[];
  }

  export interface AutoSaveManifest {
    instances: AutoSaveInstanceSummary[];
  }

  export interface PruneResult {
    manifest: AutoSaveManifest;
    evictedStorageKeys: string[];
  }
  ```
- **Pure Transformations:**
  - `addCheckpointToManifest(manifest: AutoSaveManifest, instanceId: string, checkpoint: AutoSaveCheckpointMeta, limits?: { maxCheckpoints?: number; maxInstances?: number }): PruneResult`
  - `pruneManifest(manifest: AutoSaveManifest, limits: { maxCheckpoints: number; maxInstances: number }): PruneResult`
  - Manifest updates always bump the active instance to the top ($0$-th index).
  - Changing limits dynamically in the future applies cleanly on next prune without invalidating existing stored data.

#### 1.2 Checkpoint Storage

- Individual save points are saved under `iter.checkpoint.${instanceId}.${checkpointId}` as raw HTML produced by `stringifyChat(nodes)`.
- No text summary is stored in the metadata. Preview is derived dynamically from the checkpoint content when needed.

---

### 2. File Change Sequence

#### Step 1: Pure History Model (`src/storage/auto-save-history.ts` - New File)

- Implement pure domain logic for history representation:
  - Manifest schema and checkpoint metadata structures.
  - `createEmptyManifest(): AutoSaveManifest`
  - `addCheckpointToManifest(...)`: Inserts checkpoint, bumps instance to top, prunes according to provided or default $K$ and $P$, returns updated manifest and list of `evictedStorageKeys`.
  - `pruneManifest(...)`: Prunes instances beyond $P$ and checkpoints per instance beyond $K$, collecting any evicted keys for deletion.
  - `removeInstanceFromManifest(manifest: AutoSaveManifest, instanceId: string): PruneResult`

#### Step 2: Unit Testing History & Pruning (`src/storage/auto-save-history.test.ts` - New File)

- Test history model independently without IDB or DOM:
  - Adding checkpoints and instance ranking (bumping modified instance to top).
  - Enforcing $K$ limit per instance and capturing evicted checkpoint keys.
  - Enforcing $P$ instance limit and capturing all evicted keys of dropped instances.
  - Pruning with custom/updated limits (e.g. reducing $K$ from 10 to 5 or $P$ from 10 to 3) without data corruption.
  - Verify parameter values are imported directly from `auto-save-history.ts`.

#### Step 3: Auto-Save Engine (`src/storage/auto-save-service.ts` - New File)

- Coordinates serialization and persistence with `idb-keyval`:
  - `isThreadEmpty(nodes: ChatNode[]): boolean`: Returns true if thread has $\le 2$ nodes with empty text and no attachments.
  - `saveCheckpoint(instanceId: string, nodes: ChatNode[], limits?: { maxCheckpoints?: number; maxInstances?: number }): Promise<boolean>`
    - Guard: If `isThreadEmpty(nodes)` is true, do not perform save.
    - Stringifies `nodes` using `stringifyChat`.
    - Generates checkpoint record and key `iter.checkpoint.${instanceId}.${checkpointId}`.
    - Updates manifest in IDB.
    - Writes checkpoint file in IDB.
    - Deletes all `evictedStorageKeys` from IDB using `delMany` / `del`.
  - `hasCheckpoints(): Promise<boolean>`

#### Step 4: Restore Engine (`src/storage/restore-service.ts` - New File)

- Implements checkpoint retrieval, preview parsing, and download:
  - `getManifest(): Promise<AutoSaveManifest>`
  - `getCheckpointRaw(storageKey: string): Promise<string | undefined>`
  - `getCheckpointPreview(storageKey: string): Promise<{ lastMessages: { role: string; content: string }[] }>`: Parses raw HTML and extracts the last two chat messages.
  - `downloadCheckpointFile(storageKey: string, filename?: string): Promise<void>`: Downloads checkpoint as raw HTML file.
  - `restoreCheckpointNodes(storageKey: string, preserveIds?: string[]): Promise<ChatNode[]>`: Loads and parses HTML to `ChatNode[]`.

#### Step 5: Unit Testing Storage Services (`src/storage/auto-save-service.test.ts` & `src/storage/restore-service.test.ts` - New Files)

- Test with mocked `idb-keyval` and DOM parser utilities:
  - Auto-save ignores empty threads.
  - Auto-save persists raw HTML and deletes evicted keys in IDB.
  - Restore correctly retrieves raw HTML, parses the last two messages, and restores `ChatNode[]`.
  - Downloading generates the correct File/Blob payload.

#### Step 6: Performant React Hook (`src/storage/use-auto-save.ts` - New File)

- High-performance, data-driven hook:
  - Holds `instanceId` in a `useRef` (stable across lifecycle, unique per window/tab).
  - Uses `useRef` for save locks (`isSavingRef`) and restore state flags (`isRestoredStateRef`) so background saves do NOT trigger component re-renders.
  - Tracks `hasRecoveryData` boolean in React state only for the initial empty-thread recovery button visibility (checked on mount and after restores/saves).
  - Exposes:
    - `save(nodes: ChatNode[]): Promise<void>`
    - `restore(storageKey: string, currentNodes: ChatNode[]): Promise<ChatNode[]>`
    - `hasRecoveryData: boolean`
    - `instanceId: string`

#### Step 7: Restore Dialog Component & Styles

- **`src/chat-tree/restore-dialog.css` (New File):**
  - Master-detail layout styling matching app theme.
  - Left pane: Instance list (newest first, timestamp, checkpoint count).
  - Right pane: Active checkpoint viewer with navigation ("Prev", "Next", "X of Y"), preview box showing the last two messages with role tags, and action buttons ("Download", "Load", "Cancel").
- **`src/chat-tree/restore-dialog.tsx` (New File):**
  - Component props: `isOpen: boolean`, `onClose: () => void`, `onRestore: (nodes: ChatNode[]) => void`, `currentNodes: ChatNode[]`.
  - Displays master list of instances and detail view of checkpoints.
  - Prev/Next navigation cycles through checkpoints of selected instance.
  - Detail view renders the last two messages extracted via `getCheckpointPreview`.
  - "Download" button calls `downloadCheckpointFile` to save raw HTML.
  - "Load" button loads checkpoint, invokes `onRestore`, and closes dialog.
  - Closes on `Escape` key and backdrop/cancel actions.

#### Step 8: Chat Tree Integration (`src/chat-tree/chat-tree.tsx` & `src/chat-tree/chat-tree.css`)

- **`src/chat-tree/chat-tree.css`:**
  - Styles for recovery button container positioned at the bottom of the empty message list.
- **`src/chat-tree/chat-tree.tsx`:**
  - Wire `useAutoSave`.
  - Trigger `save` at the two designated moments in `handleRunNode`:
    1. **After user prompt submission:** Right after appending user & assistant placeholder nodes.
    2. **After AI completion:** In `try ... finally` when assistant streaming finishes or encounters error.
  - Conditionally display the "Restore" button when `isThreadEmpty(treeNodes)` and `hasRecoveryData` are both true.
  - Clicking "Restore" opens `RestoreDialog`.
  - Restoring updates `treeNodes` and sets `isRestoredStateRef` so no save is triggered until the next user submission or AI response.

---

### 3. Edge Cases & Verification Plan

- **Dynamic Limit Changes:** If $K$ or $P$ are changed in configuration, subsequent saves prune excess records smoothly without crashes or dangling storage entries.
- **Pruning Thoroughness:** Both per-instance checkpoints exceeding $K$ and oldest instances exceeding $P$ are pruned from manifest and their corresponding IDB keys are deleted.
- **Zero UI Lag:** Auto-save operations run in background tasks with no React state re-render cascades.
- **Accidental Close / Reload:** Opening a new tab shows the empty thread with the "Restore" button; user can inspect the last 2 messages of previous checkpoints and load or download raw HTML.
- **Regeneration Safety:** Every prompt submission and completion creates a distinct checkpoint, enabling recovery of previous branches.
