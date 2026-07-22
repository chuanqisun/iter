---
status: Completed
---

# RFC 001: Paste Text as an Embedded Attachment

## Summary

When a user presses `Mod-Shift-V` in a user or system chat editor, inspect the clipboard for text content and add it to the active user message as an embedded attachment instead of inserting it into the editor.

The default filename depends on the clipboard content type. Plain text starts as `filename.txt`; HTML or Markdown starts as `filename.md`. After insertion, open the existing filename dialog with that name selected. Cancelling the dialog keeps the attachment.

`Mod` means `Ctrl` on Windows/Linux and `Meta` on macOS.

## Outcome

- `Mod-Shift-V` in a user or system chat editor creates one embedded text attachment when the clipboard exposes `text/plain`, `text/html`, or `text/markdown` and does not change the editor text.
- Plain-text-only content starts as `filename.txt`; HTML or Markdown content starts as `filename.md`.
- When multiple supported types are present, Markdown or HTML takes precedence over plain text for choosing the filename.
- HTML content uses its `text/plain` representation. Markdown and plain text use their respective payloads.
- The attachment uses MIME type `text/plain` and is `embedded` by default.
- The rename dialog opens for the new attachment after insertion.
- Existing attachment-name collision handling remains in effect.
- Normal paste behavior is unchanged, including HTML-to-Markdown conversion and pasted-file/image attachments.
- Preview and source editors retain their current paste behavior.

## Why Handle Keydown Upstream

`Mod-Shift-V` is normally interpreted by the browser as "paste as plain text." By the time the resulting `paste` event reaches application code, the browser may have removed the `text/html` clipboard item. Calling `event.clipboardData.getData("text/html")` cannot recover data that the browser has already filtered.

The chat UI already owns the desired behavior, so it should handle the initiating `keydown` directly. `ChatNode` can recognize the exact gesture before the browser performs its native paste, prevent that paste, and delegate attachment creation to `ChatTree`.

This is simpler than carrying intent from `keydown` to `paste` through a CodeMirror plugin:

- no CodeMirror command or `ViewPlugin`;
- no one-shot mutable state;
- no custom paste event;
- no opt-in attribute on the shared editor;
- no timing or event-order dependency.

The cost is that the handler must use `navigator.clipboard.read()` to inspect MIME types before choosing the payload and default filename. This API requires a secure context, has narrower browser support than `readText()`, and may be rejected by browser permission policy. It also does not provide a useful source filename for copied text. Those constraints are acceptable for this convenience gesture and keep the implementation small.

## Design

### 1. Handle the Gesture in `ChatNode`

Add an `onPasteTextAsAttachment` callback to `ChatNodeProps`:

```ts
onPasteTextAsAttachment: (nodeId: string) => void;
```

Bind `onkeydown` on the editable chat `code-editor-element` and reuse the existing `getCombo` helper. When `getCombo(event) === "ctrl+shift+v"` and `event.repeat` is false, call `event.preventDefault()` and invoke `onPasteTextAsAttachment(node.id)`.

User and system nodes already share this editor branch, while preview and source editors do not, so no separate opt-in mechanism is needed.

Do not wait for a `paste` event and do not change `src/code-editor/clipboard.ts` or `src/code-editor/chat-keymap.ts`.

### 2. Read Rich Clipboard Text in `ChatTree`

The `ChatTree` callback should:

1. Resolve the active user node with `getActiveUserNodeId` before awaiting clipboard access.
2. Call `navigator.clipboard.read()`.
3. Find the first `ClipboardItem` whose `types` contains `text/markdown`, `text/html`, or `text/plain`.
4. Return without creating an attachment when no matching item exists.
5. Choose the content type in this order: `text/markdown`, `text/html`, then `text/plain`.
6. For Markdown, read the `text/markdown` payload. For HTML, read the item's `text/plain` representation and return if none exists. For plain text, read the `text/plain` payload.
7. Return without creating an attachment when the text is empty.
8. Create an embedded text attachment named `filename.md` for Markdown or HTML, or `filename.txt` for plain text.
9. Insert it with `upsertAttachments`.
10. Open the rename dialog for that attachment ID.
11. Restore focus to the originating chat editor when the dialog closes.

If clipboard access fails, show the existing toast error and leave the editor unchanged. There is no asynchronous fallback to native paste because the keydown default must be prevented before clipboard access completes. The same applies when the clipboard does not expose a supported text type: the command does nothing and does not insert clipboard text.

### 3. Keep Attachment Construction in the Attachment Domain

Add a focused factory to `src/chat-tree/attachment.ts`:

```ts
createEmbeddedTextAttachment(text: string, filename = "filename.txt"): AttachmentEmbedded
```

The factory should:

- generate the ID with `crypto.randomUUID()`;
- sanitize the filename with `getValidAttachmentFileName`;
- set the attachment type to `embedded`;
- set the file MIME type to `text/plain`;
- encode the content with the existing `textToDataUrl` helper;
- calculate UTF-8 byte size with `new Blob([text]).size`.

### 4. Insert Before Rename

Insert the attachment before opening the filename dialog. This keeps the attachment when rename is cancelled and lets `upsertAttachments` select a collision-safe name such as `filename (1).md` before the dialog opens.

Refactor the existing rename handler only enough for button-initiated and paste-initiated rename to share the same prompt and mutation function. The shared function should look up the attachment by ID after insertion so it uses the collision-adjusted name.

## Files to Change

| File                               | Change                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/chat-tree/chat-node.tsx`      | Detect `Mod-Shift-V` on the chat editor and call the new callback.                                   |
| `src/chat-tree/chat-tree.tsx`      | Detect rich clipboard text, route to the active user node, insert the attachment, and prompt rename. |
| `src/chat-tree/attachment.ts`      | Add the embedded-text factory and reuse rename construction where needed.                            |
| `src/chat-tree/attachment.test.ts` | Test encoding, UTF-8 size, filename sanitization, and collision behavior.                            |

No changes are required in the shared CodeMirror clipboard or keymap modules.

## Edge Cases

- **Empty text:** Do not create an attachment.
- **HTML clipboard content:** Store its `text/plain` representation and use `filename.md`. The HTML payload is used only as a MIME marker.
- **Markdown clipboard content:** Store its `text/markdown` payload and use `filename.md`.
- **Plain-text-only clipboard:** Store its `text/plain` payload and use `filename.txt`.
- **Multiple text types:** Prefer Markdown, then HTML, then plain text when choosing the payload and default filename.
- **Clipboard file:** This gesture does not preserve the file's name. Normal paste remains responsible for files and images.
- **Duplicate name:** Let `upsertAttachments` assign a numeric suffix before rename.
- **Rename cancellation:** Keep the new attachment under its current name.
- **Clipboard denial:** Show an error and do not insert text or create an attachment.
- **Repeated keydown:** Ignore `event.repeat` to avoid duplicate permission requests and attachments.
- **Focus:** Return focus to the originating chat editor after rename completes or is cancelled.

## Testing and Acceptance

### Automated Tests

- The keydown handler accepts Ctrl+Shift+V and Meta+Shift+V.
- Ctrl+V, Meta+V, Shift+V, Alt-modified combinations, and repeated keydowns are ignored.
- A handled gesture prevents the native paste.
- Clipboard items with `text/html` and a `text/plain` representation create an attachment named `filename.md`.
- Clipboard items with `text/markdown` create an attachment named `filename.md`.
- Plain-text-only clipboard items create an attachment named `filename.txt`.
- Empty clipboard content creates no attachment.
- Clipboard failure creates no attachment and reports an error.
- The factory creates an embedded `text/plain` data URL with the correct UTF-8 byte size.
- Duplicate names are adjusted by `upsertAttachments` before rename.
- Cancelling rename leaves the attachment present.

### Manual Acceptance

1. Copy rich text that exposes `text/html`, focus a user chat editor, and press `Mod-Shift-V`. Confirm no text is inserted, an embedded `filename.md` attachment appears, and the rename dialog opens.
2. Repeat in a system editor and confirm the attachment is routed to the active user node.
3. Cancel rename and confirm the attachment remains.
4. Repeat the gesture and confirm the second attachment gets a unique name before rename.
5. Copy plain text and press `Mod-Shift-V`. Confirm no text is inserted and an embedded `filename.txt` attachment appears.
6. Copy Markdown that exposes `text/markdown` and press `Mod-Shift-V`. Confirm no text is inserted and an embedded `filename.md` attachment appears.
7. Press normal `Mod-V` with rich HTML and confirm HTML-to-Markdown conversion still works.
8. Use `Mod-Shift-V` in a preview or source editor and confirm its existing behavior is unchanged.
9. Deny clipboard access and confirm an error is shown without changing editor content.

Run `npm test` and `npm run build` after implementation.

## Complexity Evaluation

The upstream-keydown approach is low implementation complexity: one event handler, one callback, and one attachment factory. It removes the most delicate part of the previous design, the stateful bridge between separate keyboard and paste events.

Its operational complexity is also explicit and contained. Clipboard permission can fail, `navigator.clipboard.read()` is not available in every browser, and preventing native paste means that failure or unsupported clipboard content cannot fall back automatically. Avoiding the Clipboard API would require returning to the larger `keydown`-to-`paste` state machine; that additional machinery is not justified for this text-attachment gesture.

## Out of Scope

- Reading or converting the `text/html` payload; it is used only as a MIME marker, while its `text/plain` representation is stored.
- Retaining filenames from clipboard files.
- Changing ordinary `Mod-V` behavior.
- Adding attachments from preview or source editors.
- Supporting multiple attachments from one gesture.
- Changing the persisted attachment schema or filename dialog UI.
