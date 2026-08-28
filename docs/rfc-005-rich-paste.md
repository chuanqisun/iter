# Multi-format pasting

## Goal

Allow user to revert to plaintext pasting

## Context

currently we auto format pasted html into markdown. But sometimes we want to preserve the plaintext format.

## How

When we run html-> markdown conversion for codemirror editor, we also check the text representation of the copied text. If the markdown version is different from the plaintext version, we insert a history undo transaction that allows the user to revert to the plaintext version.

## Per file change plan

### 1. `src/code-editor/clipboard.ts`

Update the CodeMirror `Clipboard()` DOM event handler for the `paste` event:

- **Extract plain text**: Synchronously retrieve plain text from `event.clipboardData.getData("text/plain")` at the start of the paste event handler.
- **Compare formats**: After converting `html` to `markdown` via `htmlToMarkdown(html)`:
  - If `plainText` is present and `markdown !== plainText`:
    - Dispatch two distinct transactions in sequence to create a two-step history entry:
      1. **Transaction 1 (Plain text step)**: Insert `plainText` at the current selection range (`from` to `to`) with `userEvent: "input.paste"` and `isolateHistory.of("before")`.
      2. **Transaction 2 (Markdown step)**: Replace the inserted `plainText` range (`from` to `from + plainText.length`) with `markdown` with `userEvent: "input.paste"` and `isolateHistory.of("before")`.
    - This allows pressing <kbd>Ctrl</kbd>+<kbd>Z</kbd> (Undo) once to revert from Markdown to the plain text version, and pressing <kbd>Ctrl</kbd>+<kbd>Z</kbd> a second time to undo the paste entirely.
  - If `markdown === plainText` or `plainText` is empty/unavailable:
    - Dispatch a single transaction inserting `markdown` (preserving current behavior).

### 2. `src/code-editor/clipboard.test.ts` (New File)

Create unit tests for the CodeMirror clipboard paste handler:

- Test multi-format HTML paste (`markdown !== plainText`):
  - Verify editor state contains converted markdown after paste.
  - Execute `undo(view)`: verify editor content reverts to plain text.
  - Execute `undo(view)` again: verify editor content reverts to pre-paste state.
- Test single-format paste (`markdown === plainText`):
  - Verify editor state contains markdown after paste.
  - Execute `undo(view)`: verify editor content directly reverts to pre-paste state in one step.
- Test plain text paste (without `text/html` item):
  - Verify paste handler returns early and lets browser default paste behavior proceed.
