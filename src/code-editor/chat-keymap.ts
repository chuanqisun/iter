import { type KeyBinding } from "@codemirror/view";
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
  ] as KeyBinding[];
