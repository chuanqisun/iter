import "./chat-panel.css";

import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, keymap, showPanel, type KeyBinding } from "@codemirror/view";
import { getChatInstance } from "../chat-tree/chat-instance";
import { getCombo } from "../chat-tree/keyboard";
import { extractStreamContent } from "./parse-xml";
import { getCursorChatMessages } from "./prompt";
import { syncDispatch } from "./sync";

// Reference: https://codemirror.net/examples/panel/
export function chatPanel(): Extension[] {
  const toggleChat = StateEffect.define<boolean>();

  const chatPanelState = StateField.define<boolean>({
    create: () => false,
    update(value, tr) {
      for (let e of tr.effects) if (e.is(toggleChat)) value = e.value;
      return value;
    },
    provide: (f) => showPanel.from(f, (on) => (on ? createChatPanel : null)),
  });

  function createChatPanel(view: EditorView) {
    const dom = document.createElement("div");
    const textarea = document.createElement("textarea");
    textarea.id = "chat-textarea";
    textarea.placeholder = "Type your message here...";
    textarea.addEventListener("keydown", (e) => {
      const combo = getCombo(e);
      switch (combo) {
        case "ctrl+k":
        case "escape":
          e.preventDefault();
          e.stopPropagation();
          view.focus();
          view.dispatch({ effects: toggleChat.of(false) });
          break;

        case "ctrl+enter":
          e.preventDefault();
          e.stopPropagation();
          const prompt = textarea.value;
          textarea.value = "";
          handleChatRequest({ view, prompt });
          break;

        case "tab":
          e.preventDefault();
          e.stopPropagation();
          // cycle context modes: file-file, file-selection, selection-selection
          break;
      }
    });

    dom.appendChild(textarea);
    dom.className = "cm-chat-panel";
    setTimeout(() => textarea.focus(), 0);
    return { top: false, dom };
  }

  async function handleChatRequest(params: { view: EditorView; prompt: string }) {
    const { view, prompt } = params;

    const currentSelectionRange = view.state.selection.main;

    const selectedText = view.state.sliceDoc(currentSelectionRange.from, currentSelectionRange.to);
    const fullText = view.state.doc.toString();

    // surround the selectedText with <cursor></cursor>
    const fullTextWithCursor =
      fullText.slice(0, currentSelectionRange.from) + "<cursor>" + selectedText + "</cursor>" + fullText.slice(currentSelectionRange.to);

    const lang = params.view.contentDOM.closest("code-editor-element")?.getAttribute("data-lang") ?? "text";
    console.log({ selectedText, fullText, fullTextWithCursor, lang });

    const chatViewContainer = document.createElement("div");
    const chatView = new EditorView({
      state: EditorState.create({ doc: view.state.doc }), // share doc and nothing else
      parent: chatViewContainer,
      dispatch: (tr) => syncDispatch(tr, chatView, view),
    });

    const chat = getChatInstance();
    const chunks = chat({ messages: getCursorChatMessages({ prompt, lang, fullTextWithCursor }) });

    // clear the text in the currentSelectionRange
    // shrink the currentSelectionRange in chatView
    chatView.dispatch({
      changes: { from: currentSelectionRange.from, to: currentSelectionRange.to, insert: "" },
      selection: { head: currentSelectionRange.from, anchor: currentSelectionRange.from },
    });

    const newCursorContent = extractStreamContent(chunks, "cursor-new");

    for await (const chunk of newCursorContent) {
      chatView.dispatch({
        changes: { from: chatView.state.selection.main.from, insert: chunk },
        selection: { anchor: chatView.state.selection.main.from + chunk.length, head: chatView.state.selection.main.from + chunk.length },
      });
    }

    // destory the view
    chatView.destroy();
  }

  const chatKeymap: KeyBinding[] = [
    {
      key: "Ctrl-k",
      mac: "Meta-k",
      run(view) {
        const isCurrentlyOpen = view.state.field(chatPanelState);

        if (isCurrentlyOpen) {
          const textarea = view.dom.querySelector<HTMLTextAreaElement>("#chat-textarea");
          const isTextareaFocused = textarea === document.activeElement;
          if (!isTextareaFocused) {
            textarea?.focus();
            return true;
          }
        }

        view.dispatch({
          effects: toggleChat.of(!isCurrentlyOpen),
        });
        return true;
      },
    },
  ];

  const chatTheme = EditorView.baseTheme({
    ".cm-chat-panel": {
      display: "grid",
      fontFamily: "monospace",
    },
  });

  return [chatPanelState, keymap.of(chatKeymap), chatTheme];
}
