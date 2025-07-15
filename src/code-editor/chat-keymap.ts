import { EditorSelection } from "@codemirror/state";
import { type KeyBinding, EditorView } from "@codemirror/view";
import type { Subject } from "rxjs";
import type { CodeEditorElement } from "./code-editor-element";

export interface CommandEventDetails {
  command: string;
}

export const chatKeymap = (eventTarget: CodeEditorElement, change$: Subject<string>) =>
  [
    {
      key: "Ctrl-Enter",
      mac: "Meta-Enter",
      run: (view) => {
        eventTarget.dispatchEvent(new CustomEvent("run", { detail: view.state.doc.toString() }));
        return true;
      },
    },
    {
      key: "Enter",
      run: () => {
        if (eventTarget.hasAttribute("data-readonly")) {
          eventTarget.dispatchEvent(new Event("enterreadonly"));
          return true;
        }
        return false;
      },
    },
    {
      key: "Enter",
      run: autoCloseCodeBlock,
    },
    {
      key: "Escape",
      run: (view) => {
        // if there is selection, collapse to head
        if (!view.state.selection.main.empty) return false;

        if (eventTarget.hasAttribute("data-readonly")) {
          eventTarget.dispatchEvent(new Event("escapereadonly"));
        } else {
          // emit change event on exit
          change$.next(view.state.doc.toString());
          eventTarget.dispatchEvent(new Event("escape"));
        }
        return true;
      },
    },
    {
      key: "ArrowUp",
      run: (view) => {
        const cursor = view.state.selection.main.head;
        if (cursor === 0 && view.state.selection.main.empty) {
          eventTarget.dispatchEvent(new Event("navigateprevious"));
          return true;
        }
        return false;
      },
    },
    {
      key: "ArrowDown",
      run: (view) => {
        const cursor = view.state.selection.main.head;
        if (cursor === view.state.doc.length && view.state.selection.main.empty) {
          eventTarget.dispatchEvent(new Event("navigatenext"));
          return true;
        }
        return false;
      },
    },
  ] as KeyBinding[];

// Custom command for triple backtick + run
function autoCloseCodeBlock({ state, dispatch }: EditorView) {
  const { from, to } = state.selection.main;
  const line = state.doc.lineAt(from);
  const lineText = line.text;

  // Check if the line starts with ```run
  if (/^```\w+/.test(lineText)) {
    // Check if there's already a closing ``` somewhere after current position
    const remainingDoc = state.doc.sliceString(to);
    const hasClosingTicks = /\n```(?:\n|$)/.test(remainingDoc);

    if (hasClosingTicks) {
      // Just insert a new line, don't add closing ticks
      const changes = { from: to, to: to, insert: "\n" };
      const selection = EditorSelection.cursor(to + 1);
      dispatch(
        state.update({
          changes,
          selection,
          userEvent: "input",
        }),
      );
    } else {
      // Insert a new line, move cursor, and insert closing ```
      const insertText = "\n\n```";
      const changes = { from: to, to: to, insert: insertText };
      // Place cursor on the empty line between the ticks
      const selection = EditorSelection.cursor(to + 1);
      dispatch(
        state.update({
          changes,
          selection,
          userEvent: "input",
        }),
      );
    }
    return true; // Handled
  }
  return false; // Not handled, fall back to default
}
