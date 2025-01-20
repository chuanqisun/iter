import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, keymap, showPanel, type KeyBinding } from "@codemirror/view";
import { getChatInstance } from "../chat-tree/chat-instance";
import { getCombo } from "../chat-tree/keyboard";

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
          const chat = getChatInstance();
          const response = chat({ messages: [{ role: "user", content: textarea.value }] });
          renderChatResponse(response);
      }
    });
    dom.appendChild(textarea);
    dom.className = "cm-chat-panel";
    setTimeout(() => textarea.focus(), 0);
    return { top: false, dom };
  }

  async function renderChatResponse(chunks: AsyncGenerator<string>) {
    for await (const chunk of chunks) console.log(chunk);
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
