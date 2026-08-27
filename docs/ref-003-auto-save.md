# Outline

- Goal
  - Prevent data loss due to (1) accidental close of window/tab, and (2) accidental regeneration/branching of earlier messages in the thread.
- Independence from Manual Save/Open
  - The existing manual file operations (`mod+s`, `mod+o`, `mod+shift+s`, `mod+shift+o`) remain completely independent from the auto-save system.
  - Manual save/open operations do NOT read from, write into, or alter the auto-save history/manifest in any way.
- Timing
  - Auto-save performed at non-disruptive moments: (1) after user submits a request and (2) after AI finishes responding. The former fills network waiting time, the latter fills user's reaction time.
  - Do NOT trigger auto-save on empty thread. When user opens the app and reloads a few times, nothing should be saved.
  - After restoring a save point, do NOT auto-save the newly restored state until user submits or AI finishes responding.
- User experience
  - Saving is performed in the background with no visual indication or unnecessary component re-rendering.
  - Recovery is performed via a "Restore" button and a dialog for inspecting and picking the save point.
  - The "Restore" button is located in the system message menu, permanently available, and shares the exact same action button styles as other message menu actions.
- Data modeling
  - Each app instance has a unique id (mapping to each tab/window in the browser where the app runs).
  - Checkpoint overwrite vs. creation strategy:
    - By default, auto-save **overwrites** the existing checkpoint for the current instance (updating its HTML payload and timestamp).
    - A **new checkpoint** is created for the app instance ONLY under two scenarios:
      (a) It is the first save for the instance and there is no existing checkpoint to overwrite.
      (b) It is triggered from the user submitting a message that is not at the tail of the thread (which implies the user is branching or wiping downstream messages).
  - We preserve the most recent K (=10 by default) save points per app instance.
  - We preserve the most recent P (=10 by default) app instances. Newer changes bump the active instance to the top of the list.
  - Limits (K and P) may change over time without breaking existing data or format.
  - The window/tab identity is immutable. Opening a new tab/window creates a new instance, and restoring a closed tab/window means copying the state into the current instance.
- Data recovery
  - A "Restore" button is available in the system message menu.
  - The recovery dialog uses a master-detail pattern matching the styling of the connections settings dialog:
    - Master pane: list of app instances (newest first). Each item shows timestamp on the first line and number of save points on the second line (without instance ID). Left pane is compact with no gap and no padding around the list.
    - Detail pane: save point navigation ("Newer" and "Older" buttons without unicode arrows, showing "X/Y" index info), and chronological preview of the entire thread with emoji role icons (⚙️ for system, 👤 for user, 🤖 for assistant).
    - An "Export" button in the dialog allows downloading the selected save point as its raw HTML file.
    - A "Load" button copies the selected save point into the current app instance and closes the dialog. The user can then continue to work on the restored state.
    - Escape key closes the dialog (consistent with existing system dialogs).
- Storage & Architecture
  - Modular separation into three distinct layers:
    1. **History Management**: In-memory data structures and pure functions managing instance lists, checkpoints (create vs. overwrite), ranking, and limit pruning without storage or UI dependencies.
    2. **Auto-Save**: Orchestrates timing, checks empty thread guard, detects non-tail submissions, serializes chat data to HTML, hydrates history, writes to Indexed DB (via `idb-keyval`), and cleans up deleted keys.
    3. **Restore**: Reads checkpoints/manifest from Indexed DB, extracts and formats chronological thread preview, enables raw HTML export, and populates the app.
- Testing
  - Carefully test history management, auto-save, restore, and pruning behavior (without DOM).
  - Explicitly unit test checkpoint overwrite vs. new checkpoint branch creation, and pruning algorithms (both instance-level and checkpoint-level key eviction and limit changes).
  - Do NOT hard code limits in the test code. Do NOT implement business logic in the test code. Instead, import parameters from the main code and test dynamic limit adaptations.
- Refactoring
  - Implement the full feature, then refactor the code to reduce unnecessary duplication of logic, and ensure high readability and maintainability.
  - Avoid commenting. Instead prefer self-evident naming. Comment is only needed for special hacks/workarounds.
- Styling
  - "Restore" button is in the system message actions menu sharing identical styles with `message-actions` button elements.
  - Dialog structure, header, body, field rows, actions, and form layouts use the same CSS design tokens and style rules as the connections settings dialog.

## Implementation plan

### 1. Architecture & Data Modeling

```
+-------------------------------------------------------------+
|                     React UI Layer                          |
|  - ChatTree (triggers save on submit / complete)            |
|  - Restore Button (text-link style matching message actions)|
|  - RestoreDialog (settings-style master-detail UI)          |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                 useAutoSave Hook (React Adapter)            |
|  - Holds mutable instanceId, activeCheckpointId, save locks |
|  - Subscribes to recovery data availability                 |
|  - Exposes save/restore callbacks without re-renderings     |
|  - Fully isolated from manual mod+s/o & mod+shift+s/o       |
+---------------+------------------------------+--------------+
                |                              |
                v                              v
+-------------------------------+ +---------------------------+
|       Auto-Save Engine        | |      Restore Engine       |
|  - Empty thread detection     | |  - Fetch checkpoint & list|
|  - Tail vs. non-tail detection| |  - Chronological preview  |
|  - stringifyChat serialization| |  - parseChat & populate   |
|  - Coordinates IDB writes     | |  - Download raw HTML file |
|  - Overwrite vs create logic  | |                           |
+---------------+---------------+ +-------------+-------------+
                |                               |
                +---------------+---------------+
                                |
                                v
+-------------------------------------------------------------+
|                 History Store (Pure Model)                  |
|  - AutoSaveManifest & Checkpoint data structures            |
|  - Pure functions: recordCheckpoint (overwrite vs create)   |
|  - bumpInstance, pruneManifest                              |
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

  export interface RecordCheckpointOptions {
    instanceId: string;
    checkpointId?: string;
    isNewBranch?: boolean;
    limits?: { maxCheckpoints?: number; maxInstances?: number };
  }

  export interface PruneResult {
    manifest: AutoSaveManifest;
    activeCheckpointId: string;
    evictedStorageKeys: string[];
  }
  ```
- **Pure Transformations:**
  - `recordCheckpointInManifest(manifest: AutoSaveManifest, options: RecordCheckpointOptions): PruneResult`
    - Overwrites current checkpoint metadata (timestamp update) if `checkpointId` exists and `isNewBranch` is false.
    - Creates a new checkpoint when `checkpointId` is missing or when `isNewBranch` is true (non-tail edit/resubmission).
    - Always bumps the modified instance to the top ($0$-th index).
    - Enforces $K$ checkpoints per instance (evicting oldest) and $P$ instances (evicting dropped instances).
  - `pruneManifest(manifest: AutoSaveManifest, limits: { maxCheckpoints: number; maxInstances: number }): PruneResult`
  - Changing limits dynamically in the future applies cleanly on next prune without invalidating existing stored data.

#### 1.2 Checkpoint Storage

- Checkpoint payload is saved under `iter.checkpoint.${instanceId}.${checkpointId}` as raw HTML produced by `stringifyChat(nodes)`.
- No separate text summary is stored in metadata; chronological message preview is parsed on-demand from the raw HTML.
- Manual file shortcut actions (`mod+s`, `mod+o`, `mod+shift+s`, `mod+shift+o`) do not touch or read this store.

---

### 2. File Change Sequence

#### Step 1: Pure History Model (`src/storage/auto-save-history.ts` - New File)

- Implement pure domain logic:
  - Manifest schema and checkpoint metadata.
  - `createEmptyManifest(): AutoSaveManifest`
  - `recordCheckpointInManifest(manifest, options)`: Handles checkpoint overwrite by default, new checkpoint creation on first save or branch, instance ranking, and pruning.
  - `pruneManifest(manifest, limits)`: Prunes checkpoints beyond $K$ and instances beyond $P$, gathering evicted storage keys.
  - `removeInstanceFromManifest(manifest, instanceId)`

#### Step 2: Unit Testing History & Pruning (`src/storage/auto-save-history.test.ts` - New File)

- Test history model independently:
  - Overwriting existing checkpoint updates timestamp and retains single checkpoint entry without key eviction.
  - Branching (`isNewBranch: true`) appends a new checkpoint.
  - Enforcing $K$ limit per instance and capturing evicted checkpoint keys.
  - Enforcing $P$ instance limit and capturing all evicted keys of dropped instances.
  - Dynamic limit adaptation tests using imported constants.

#### Step 3: Auto-Save Engine (`src/storage/auto-save-service.ts` - New File)

- Coordinates serialization and persistence with `idb-keyval`:
  - `isThreadEmpty(nodes: ChatNode[]): boolean`: Returns true if thread has $\le 2$ nodes with empty text and no attachments.
  - `saveCheckpoint(instanceId: string, currentCheckpointId: string | undefined, isNewBranch: boolean, nodes: ChatNode[]): Promise<{ checkpointId: string } | null>`
    - Guard: If `isThreadEmpty(nodes)` is true, skip save.
    - Serializes `nodes` via `stringifyChat`.
    - Updates IDB manifest via `recordCheckpointInManifest`.
    - Writes HTML to `iter.checkpoint.${instanceId}.${checkpointId}` in IDB.
    - Deletes all `evictedStorageKeys` from IDB.
  - `hasCheckpoints(): Promise<boolean>`

#### Step 4: Restore Engine (`src/storage/restore-service.ts` - New File)

- Implements checkpoint retrieval, chronological preview parsing, and download:
  - `getManifest(): Promise<AutoSaveManifest>`
  - `getCheckpointRaw(storageKey: string): Promise<string | undefined>`
  - `getCheckpointPreview(storageKey: string): Promise<{ messages: { role: string; content: string }[] }>`: Parses raw HTML and extracts the entire message thread in chronological order.
  - `downloadCheckpointFile(storageKey: string, filename?: string): Promise<void>`: Downloads checkpoint as raw HTML file.
  - `restoreCheckpointNodes(storageKey: string): Promise<ChatNode[]>`: Loads and parses HTML to `ChatNode[]`.

#### Step 5: Unit Testing Storage Services (`src/storage/auto-save-service.test.ts` & `src/storage/restore-service.test.ts` - New Files)

- Test with mocked `idb-keyval` and DOM parser:
  - Auto-save ignores empty threads.
  - Auto-save correctly overwrites by default and creates new keys on branching.
  - Restore parses chronological thread preview and restores nodes.
  - Verifies manual shortcut commands remain completely unaffected.

#### Step 6: Performant React Hook (`src/storage/use-auto-save.ts` - New File)

- High-performance hook:
  - Holds `instanceId` and `activeCheckpointIdRef` in `useRef`.
  - Holds `isSavingRef` and `isRestoredStateRef` locks.
  - Tracks `hasRecoveryData` boolean in React state only for the empty-thread "Restore" link button.
  - Exposes:
    - `save(nodes: ChatNode[], isNewBranch: boolean): Promise<void>`
    - `restore(storageKey: string): Promise<ChatNode[]>`
    - `hasRecoveryData: boolean`
    - `instanceId: string`

#### Step 7: Restore Dialog Component & Styles

- **`src/chat-tree/restore-dialog.css` (New File):**
  - Styled consistent with `settings-element.css` (modal layout, field labels, action rows, button styles, scroll areas).
  - Left pane: Instance list (newest first, timestamp, checkpoint count, compact layout without gaps/padding).
  - Right pane: Checkpoint navigation ("Newer", "Older", "X/Y"), chronological preview container listing all thread messages with emoji role indicators, action buttons ("Export", "Load", "Cancel").
- **`src/chat-tree/restore-dialog.tsx` (New File):**
  - Props: `isOpen: boolean`, `onClose: () => void`, `onRestore: (nodes: ChatNode[]) => void`.
  - Master-detail view displaying instances and chronological checkpoint messages with emojis.
  - "Export" and "Load" handlers.
  - Closes on `Escape` key, backdrop click, or Cancel.

#### Step 8: Chat Tree Integration (`src/chat-tree/chat-tree.tsx` & `src/chat-tree/chat-node.tsx`)

- **`src/chat-tree/chat-node.tsx`:**
  - Added "Restore" action button in the system message actions menu, sharing identical styling and keyboard focus navigation with other menu buttons.
- **`src/chat-tree/chat-tree.tsx`:**
  - Wire `useAutoSave`.
  - When user runs a prompt:
    - Determine if target node is the tail of the thread (`node.id === tailNode.id`). If submitting from an earlier node, pass `isNewBranch: true` to `save(...)`.
    - Trigger `save` right after user submission and after AI streaming finishes.
  - Passes `onRestoreClick` down to system message node to open the `RestoreDialog`.
  - Ensure existing key combos (`ctrl+s`, `ctrl+o`, `ctrl+shift+s`, `ctrl+shift+o`) remain untouched and operate purely on manual file I/O.

---

### 3. Edge Cases & Verification Plan

- **Manual vs Auto-Save Isolation:** Confirm manual file save/open operations (`mod+s`, `mod+o`, `mod+shift+s`, `mod+shift+o`) have no side-effects on auto-save history or manifest.
- **Overwrite vs. New Branch Check:** Modifying and completing responses at the tail updates the active checkpoint without spawning redundant checkpoints. Submitting from an intermediate node branches into a new checkpoint.
- **Chronological Thread Preview:** Detail pane renders all thread messages in chronological sequence.
- **Visual Consistency:** "Restore" button matches chat message action links; dialog matches the connections settings dialog styling.
- **Dynamic Limit Changes:** If $K$ or $P$ limits change, excess checkpoints/instances are pruned cleanly on next save without orphaned IndexedDB entries.
- **Zero UI Lag:** Auto-save operations run in background tasks without causing unwanted component re-renders.
