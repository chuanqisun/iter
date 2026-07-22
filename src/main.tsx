import React from "react";
import ReactDOM from "react-dom/client";
import { ArtifactDividerElement } from "./artifact/artifact-divider-element";
import { ArtifactEditorElement } from "./artifact/artifact-editor-element";
import { FocusTrapElement } from "./artifact/lib/focus-trap-element";
import { ChatTree } from "./chat-tree/chat-tree";
import { CodeEditorElement } from "./code-editor/code-editor-element";
import "./index.css";
import { SettingsElement } from "./settings/settings-element";
import "./shell/center-clamp.css";

CodeEditorElement.define();
SettingsElement.define();
FocusTrapElement.define("artifact-focus-trap-element");
ArtifactDividerElement.define();
ArtifactEditorElement.define();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="c-center-clamp">
      <ChatTree />
    </div>
  </React.StrictMode>,
);
