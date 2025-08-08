import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, highlightSpecialChars, keymap, placeholder } from "@codemirror/view";
import { githubDark } from "@uiw/codemirror-theme-github/src/index.ts";
import { distinctUntilChanged, Subject, tap } from "rxjs";
import { blockActionPlugin } from "./block-action-widget";
import { chatKeymap } from "./chat-keymap";
import { chatPanel } from "./chat-panel";
import { Clipboard } from "./clipboard";
import "./code-editor-element.css";
import { syncDispatch } from "./sync";

const dynamicLanguage = new Compartment();
const dynamicReadonly = new Compartment();
const dynamicTabIndent = new Compartment();
const dynamicPlaceholder = new Compartment();

export class CodeEditorElement extends HTMLElement {
  static define() {
    if (customElements.get("code-editor-element")) return;
    customElements.define("code-editor-element", CodeEditorElement);
  }

  static observedAttributes = ["data-lang", "data-value", "data-readonly", "data-tab-indent", "data-placeholder"];

  private editorView: EditorView | null = null;
  private cursorViews: EditorView[] = [];
  private change$ = new Subject<string>();

  private extensions: Extension[] = [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    ...chatPanel(),
    blockActionPlugin,
    Clipboard(),
    EditorView.lineWrapping,
    // base key bindings without tab indent; tab indent is added dynamically
    keymap.of([...chatKeymap(this, this.change$), ...defaultKeymap, ...historyKeymap]),
    githubDark,
    dynamicReadonly.of([]),
    dynamicLanguage.of([]),
    dynamicTabIndent.of([]),
    dynamicPlaceholder.of([]),
    EditorView.focusChangeEffect.of((state, focusing) => {
      if (focusing) return null;
      this.change$.next(state.doc.toString());
      return null;
    }),
  ];

  connectedCallback() {
    this.editorView = new EditorView({
      extensions: [...this.extensions],
      dispatch: (tr) => syncDispatch(tr, this.editorView!, this.cursorViews),
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

    this.change$.pipe(distinctUntilChanged()).subscribe((value) => {
      this.dispatchEvent(new CustomEvent("contentchange", { detail: value }));
    });
    // initial tab-indent keymap based on attribute
    this.updateTabIndent(this.hasAttribute("data-tab-indent"));
    // initial placeholder based on attribute
    this.updatePlaceholder(this.getAttribute("data-placeholder"));
  }

  disconnectedCallback() {
    this.editorView?.destroy();
    this.editorView = null;
    this.cursorViews.forEach((view) => view.destroy());
    this.cursorViews = [];
    this.change$.complete();
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
    if (name === "data-tab-indent") {
      this.updateTabIndent(this.hasAttribute("data-tab-indent"));
    }
    if (name === "data-placeholder") {
      this.updatePlaceholder(newValue);
    }
  }

  updateReadonly(isReadonly: boolean) {
    const reconfig = dynamicReadonly.reconfigure(EditorState.readOnly.of(isReadonly)); // This keeps focusability while preventing edits
    // const reconfig = dynamicReadonly.reconfigure(EditorView.editable.of(!isReadonly)); // This prevent DOM focusability
    this.editorView?.dispatch({ effects: reconfig });
  }

  /** Dynamically add or remove indentWithTab key binding */
  updateTabIndent(isTabIndent: boolean) {
    const ext = isTabIndent ? keymap.of([indentWithTab]) : [];
    const reconfig = dynamicTabIndent.reconfigure(ext);
    this.editorView?.dispatch({ effects: reconfig });
  }

  /** Dynamically set the editor placeholder text via data-placeholder */
  updatePlaceholder(text: string | null) {
    // if no text, clear placeholder
    const ext = text ? placeholder(text) : [];
    const reconfig = dynamicPlaceholder.reconfigure(ext);
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
      }),
    );
  }

  focus() {
    setTimeout(() => this.editorView?.focus());
  }

  moveCursorToEnd() {
    this.editorView?.dispatch({
      selection: EditorSelection.single(this.editorView.state.doc.length),
    });
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

  spawnCursor(options?: { selection?: EditorSelection }) {
    if (!this.editorView) {
      throw new Error("EditorView not initialized");
    }

    const cursorEditor = document.createElement("div");
    const cursorView = new EditorView({
      state: EditorState.create({ doc: this.editorView.state.doc }), // share doc and nothing else
      parent: cursorEditor,
      dispatch: (tr) => syncDispatch(tr, cursorView, [this.editorView!]),
    });

    this.cursorViews.push(cursorView);

    const initialSelection = options?.selection ?? this.editorView.state.selection.main;

    // initial selection
    cursorView.dispatch({ selection: initialSelection });

    const cursorInput$ = new Subject();
    cursorInput$
      .pipe(
        tap((chunk: any) => {
          cursorView.dispatch({
            changes: { from: cursorView.state.selection.main.from, insert: chunk },
            selection: {
              anchor: cursorView.state.selection.main.from + chunk.length,
              head: cursorView.state.selection.main.from + chunk.length,
            },
          });
        }),
        tap({
          finalize: () => {
            this.cursorViews = this.cursorViews.filter((view) => view !== cursorView);
            cursorView.destroy();
          },
        }),
      )
      .subscribe();

    const replaceAll = (text: string) => {
      cursorView.dispatch({
        changes: { from: 0, to: cursorView.state.doc.length, insert: text },
        selection: { anchor: text.length, head: text.length },
      });
    };

    const write = (text: string) => cursorInput$.next(text);
    const close = () => cursorInput$.complete();

    return { write, close, replaceAll };
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
      return (
        (await languages
          .find((lang) => lang.alias.includes(ext ?? "") || lang.extensions.includes(ext ?? ""))
          ?.load()) ?? []
      );
  }
}
