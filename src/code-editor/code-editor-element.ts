import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, highlightSpecialChars, keymap } from "@codemirror/view";
import { githubDark } from "@uiw/codemirror-theme-github/src/index.ts";

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
    keymap.of([
      {
        key: "Ctrl-Enter",
        mac: "Meta-Enter",
        stopPropagation: true,
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
        stopPropagation: true,
        run: () => {
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
      this.value = this.getAttribute("data-value") ?? "";
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
    this.editorView?.setState(
      EditorState.create({
        doc: value,
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
}

async function getLanguageSupport(filenameOrExtension: string) {
  const ext = filenameOrExtension.split(".").pop();
  switch (ext) {
    case "md":
      return markdown({ codeLanguages: languages });
    default:
      return (await languages.find((lang) => lang.extensions.includes(ext ?? ""))?.load()) ?? [];
  }
}
