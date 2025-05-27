import React from "react";
import ReactDOM from "react-dom/client";
import { ArtifactEditorElement } from "./artifact/artifact-editor-element";
import { FocusTrapElement } from "./artifact/lib/focus-trap-element";
import { ChatTree } from "./chat-tree/chat-tree";
import { CodeEditorElement } from "./code-editor/code-editor-element";
import "./index.css";
import { SettingsElement } from "./settings/settings-element";
import { CenterClamp } from "./shell/center-clamp";

CodeEditorElement.define();
SettingsElement.define();
FocusTrapElement.define("artifact-focus-trap-element");
ArtifactEditorElement.define();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CenterClamp>
      <ChatTree />
    </CenterClamp>
  </React.StrictMode>,
);
