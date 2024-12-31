import React from "react";
import ReactDOM from "react-dom/client";
import { AccountContextProvider } from "./account/account-context";
import { ChatTree } from "./chat-tree/chat-tree";
import { defineCodeEditorElement } from "./code-editor/code-editor-element";
import "./index.css";
import { defineSettingsElement } from "./settings/settings-element";
import { CenterClamp } from "./shell/center-clamp";

defineCodeEditorElement();
defineSettingsElement();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AccountContextProvider>
      <CenterClamp>
        <ChatTree />
      </CenterClamp>
    </AccountContextProvider>
  </React.StrictMode>
);
