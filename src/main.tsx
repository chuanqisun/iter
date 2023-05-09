import React from "react";
import ReactDOM from "react-dom/client";
import { AccountContextProvider } from "./account/account-context";
import { ChatTree } from "./chat-tree/chat-tree";
import "./index.css";
import { CenterClamp } from "./shell/center-clamp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AccountContextProvider>
      <CenterClamp>
        <ChatTree />
      </CenterClamp>
    </AccountContextProvider>
  </React.StrictMode>
);
