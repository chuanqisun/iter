import React from "react";
import ReactDOM from "react-dom/client";
import { defineFocusTrapElement } from "./artifact/lib/focus-trap-element";
import { ChatTree } from "./chat-tree/chat-tree";
import { defineCodeEditorElement } from "./code-editor/code-editor-element";
import "./index.css";
import { defineSettingsElement } from "./settings/settings-element";
import { CenterClamp } from "./shell/center-clamp";

defineCodeEditorElement();
defineSettingsElement();
defineFocusTrapElement("artifact-focus-trap-element");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CenterClamp>
      <ChatTree />
    </CenterClamp>
  </React.StrictMode>,
);
