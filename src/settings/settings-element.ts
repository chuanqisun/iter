import type { BaseCredential } from "../providers/base";
import { createProvider } from "../providers/factory";
import { deleteCredential, listCredentials, upsertCredentials } from "./connections-store";
import "./settings-element.css";
import templateHtml from "./settings-element.html?raw";

export function defineSettingsElement() {
  customElements.define("settings-element", SettingsElement);
}

export class SettingsElement extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = templateHtml;
  }

  connectedCallback() {
    const existingConnections = this.querySelector("#existing-connections")!;

    this.addEventListener("submit", (e) => {
      e.preventDefault();
      const targetForm = (e.target as HTMLElement)?.closest("form")!;
      const isValid = targetForm.reportValidity();
      if (!isValid) return;

      const type = targetForm.getAttribute("data-type")!;
      const formData = new FormData(targetForm);

      const provider = createProvider(type);
      const parsed = provider.parseNewCredentialForm(formData);

      targetForm.reset();

      const updatedConnections = upsertCredentials(parsed);
      existingConnections.innerHTML = renderCredentials(updatedConnections);
    });

    this.addEventListener("click", (e) => {
      const targetActionTrigger = (e.target as HTMLElement)?.closest(`[data-action]`);
      const action = targetActionTrigger?.getAttribute("data-action");

      switch (action) {
        case "delete": {
          const deleteKey = targetActionTrigger?.getAttribute("data-delete")!;
          const remaining = deleteCredential(deleteKey);
          existingConnections.innerHTML = renderCredentials(remaining);

          break;
        }

        case "close": {
          this.closest("dialog")?.close();
          break;
        }
      }
    });

    existingConnections.innerHTML = renderCredentials(listCredentials());
  }
}

function renderCredentials(credentials: BaseCredential[]) {
  if (!credentials.length) return "There are no existing connections.";
  return credentials
    .map((credential) => {
      const summary = createProvider(credential.type).getCredentialSummary(credential);

      return `<div class="action-row">
        <button data-action="delete" data-delete="${credential.id}">Delete</button>
        <div>
          <div><b>${summary.title}</b> (${summary.tagLine})</div>
          <div>${summary.features}</div>
        </div>
      </div>`;
    })
    .join("");
}
