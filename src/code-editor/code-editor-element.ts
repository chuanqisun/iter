import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, highlightSpecialChars, keymap } from "@codemirror/view";
import { githubDark } from "@uiw/codemirror-theme-github/src/index.ts";
import { chatPanel } from "./chat-panel";

import "./code-editor-element.css";

const dynamicLanguage = new Compartment();
const dynamicReadonly = new Compartment();

export function defineCodeEditorElement() {
  customElements.define("code-editor-element", CodeEditorElement);
}

export class CodeEditorElement extends HTMLElement {
  static observedAttributes = ["data-lang", "data-value", "data-readonly"];

  private editorView: EditorView | null = null;

  private extensions: Extension[] = [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ...chatPanel(),
    keymap.of([
      {
        key: "Ctrl-Enter",
        mac: "Meta-Enter",
        run: () => {
          this.dispatchEvent(new CustomEvent("run", { detail: this.value }));
          return true;
        },
      },
      {
        key: "Enter",
        run: () => {
          if (this.hasAttribute("data-readonly")) {
            this.dispatchEvent(new Event("enterreadonly"));
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

          if (this.hasAttribute("data-readonly")) {
            this.dispatchEvent(new Event("escapereadonly"));
          } else {
            this.dispatchEvent(new Event("escape"));
          }
          return true;
        },
      },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    githubDark,
    dynamicReadonly.of([]),
    dynamicLanguage.of([]),
    EditorView.focusChangeEffect.of((state, focusing) => {
      if (focusing) return null;
      this.dispatchEvent(new CustomEvent("contentchange", { detail: state.doc.toString() }));
      return null;
    }),
  ];

  connectedCallback() {
    this.editorView = new EditorView({
      extensions: [...this.extensions],
      parent: this,
    });

    this.updateLanguage(this.getAttribute("data-lang") ?? "md");

    if (this.hasAttribute("data-value")) {
      // initial load, avoid setter.
      this.loadDocument(this.getAttribute("data-value") ?? "");
    }

    if (this.hasAttribute("data-autofocus")) {
      // HACK: there is an unknown issue that moves focus away when entering edit mode from clicking a button
      setTimeout(() => this.editorView?.focus());
    }
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === "data-lang") {
      this.updateLanguage(newValue);
    }

    if (name === "data-value") {
      this.value = newValue;
    }

    if (name === "data-readonly") {
      const isReadonly = this.hasAttribute("data-readonly");
      this.updateReadonly(isReadonly);
    }
  }

  updateReadonly(isReadonly: boolean) {
    const reconfig = dynamicReadonly.reconfigure(EditorState.readOnly.of(isReadonly)); // This keeps focusability while preventing edits
    // const reconfig = dynamicReadonly.reconfigure(EditorView.editable.of(!isReadonly)); // This prevent DOM focusability
    this.editorView?.dispatch({ effects: reconfig });
  }

  updateLanguage(lang: string) {
    getLanguageSupport(lang).then((lang) => {
      const reconfig = dynamicLanguage.reconfigure(lang);
      this.editorView?.dispatch({ effects: reconfig });
    });
  }

  set value(value: string) {
    const currentValue = this.editorView?.state.doc.toString();
    if (currentValue === value) return; // no-op

    this.editorView?.dispatch({
      changes: { from: 0, to: this.editorView.state.doc.length, insert: value },
    });
  }

  /** This will wipeout history and reset UI state */
  loadDocument(text: string) {
    this.editorView?.setState(
      EditorState.create({
        doc: text,
        extensions: this.extensions,
      })
    );
  }

  get value() {
    return this.editorView?.state.doc.toString() ?? "";
  }

  appendText(text: string) {
    const length = this.editorView?.state.doc.length ?? 0;
    this.editorView?.dispatch({
      changes: {
        from: length,
        to: length,
        insert: text,
      },
    });
  }

  appendSpeech(result: { previous: string; replace: string }) {
    if (!this.editorView) return;
    // if there is previous text, replace it with `replace`
    // if there is no previous text, append it with `replace`. Prefix with a space if needed
    const { replace, previous } = result;
    let selection = this.editorView.state.selection.main;

    // overwrite the selection
    if (!selection.empty && !previous) {
      const start = selection.from;
      const end = selection.to;
      this.editorView.dispatch({
        changes: { from: start, to: end, insert: "" },
        selection: { head: start, anchor: start },
      });
      selection = this.editorView.state.selection.main;
    }

    const end = selection.to;
    const docMaxLength = this.editorView.state.doc.length;
    const toSafeRange = (pos: number) => Math.max(0, Math.min(pos, docMaxLength)); // code mirror cursor can be placed after doc end.

    // replace ghost text
    if (previous) {
      // between cursor - replace.length and curosr
      const safeAnchor = toSafeRange(end - previous.length);
      const textBeforeCursor = this.editorView.state.doc.sliceString(safeAnchor, end);
      if (textBeforeCursor.endsWith(previous)) {
        const newHead = safeAnchor + replace.length;
        this.editorView.dispatch({
          changes: { from: safeAnchor, to: end, insert: replace },
          selection: { anchor: newHead },
        });

        console.log("replace", {
          previous,
          replace,
          from: safeAnchor,
          to: end,
          insert: replace,
          select: newHead,
        });
      }
      // else no op, user must have interrupted
    } else {
      const safeAnchor = toSafeRange(end - 1);
      const singleCharBeforeCursor = this.editorView.state.doc.sliceString(safeAnchor, end);
      const padding = !singleCharBeforeCursor || singleCharBeforeCursor.match(/\s/) ? "" : " ";
      const newHead = end + padding.length + replace.length;
      this.editorView.dispatch({
        changes: { from: end, to: end, insert: padding + replace },
        selection: { anchor: newHead },
      });

      console.log("append", {
        previous,
        replace,
        from: end,
        to: end,
        insert: padding + replace,
        select: newHead,
      });
    }
  }
}

async function getLanguageSupport(filenameOrExtension: string) {
  const ext = filenameOrExtension.split(".").pop();
  switch (ext) {
    case "md":
      return markdown({ codeLanguages: languages });
    default:
      return (await languages.find((lang) => lang.alias.includes(ext ?? "") || lang.extensions.includes(ext ?? ""))?.load()) ?? [];
  }
}
