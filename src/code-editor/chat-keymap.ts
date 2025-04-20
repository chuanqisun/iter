import { type KeyBinding } from "@codemirror/view";
import type { CodeEditorElement } from "./code-editor-element";

export interface CommandEventDetails {
  command: string;
}

export const chatKeymap = (eventTarget: CodeEditorElement) =>
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
          eventTarget.dispatchEvent(new Event("escape"));
        }
        return true;
      },
    },
  ] as KeyBinding[];
