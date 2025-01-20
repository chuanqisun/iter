import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, keymap, showPanel, type KeyBinding } from "@codemirror/view";
import { getCombo } from "../chat-tree/keyboard";

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
  textarea.placeholder = "Type your message here...";
  textarea.style.border = "none";
  textarea.style.width = "100%";
  textarea.style.padding = "4px 6px";
  // @ts-ignore: this is an upcoming API
  textarea.style.fieldSizing = "content";
  textarea.style.resize = "none";
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
        textarea.value = "";
        break;
    }
  });
  dom.appendChild(textarea);
  dom.className = "cm-chat-panel";
  setTimeout(() => textarea.focus(), 0);
  return { top: false, dom };
}

const chatKeymap: KeyBinding[] = [
  {
    key: "Ctrl-k",
    mac: "Meta-k",
    run(view) {
      view.dispatch({
        effects: toggleChat.of(!view.state.field(chatPanelState)),
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

export function chatPanel(): Extension[] {
  return [chatPanelState, keymap.of(chatKeymap), chatTheme];
}
