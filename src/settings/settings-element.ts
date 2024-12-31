import {
  deleteCredential,
  listCredentials,
  openaiDefaultModels,
  parseAzureOpenAICredential,
  parseOpenAICredential,
  upsertCredentials,
  type Credential,
} from "./connections";

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
    const form = this.querySelector("form")!;
    const existingConnections = this.querySelector("#existing-connections")!;

    form.addEventListener("change", (_e) => {
      const type = new FormData(form).get("newType") as string;
      this.querySelector(`[name="newEndpoint"]`)?.toggleAttribute("disabled", type !== "aoai");
    });

    this.addEventListener("click", (e) => {
      const targetForm = (e.target as HTMLElement)?.closest("form")!;

      const targetActionTrigger = (e.target as HTMLElement)?.closest(`[data-action]`);
      const action = targetActionTrigger?.getAttribute("data-action");

      switch (action) {
        case "add":
          {
            const isValid = targetForm.reportValidity();
            if (!isValid) return;

            const type = targetForm.getAttribute("data-type")!;
            const formData = new FormData(targetForm);

            let parsed: Credential[] = [];
            if (type === "openai") {
              parsed = parseOpenAICredential(formData);
            } else if (type === "aoai") {
              parsed = parseAzureOpenAICredential(formData);
            }
            if (!parsed) return;

            // reset form
            targetForm.reset();

            const updatedConnections = upsertCredentials(parsed);
            existingConnections.innerHTML = renderCredentials(updatedConnections);
          }
          break;

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

function renderCredentials(credentials: Credential[]) {
  if (!credentials.length) return "There are no existing connections.";
  return credentials
    .map((credential) => {
      switch (credential.type) {
        case "openai":
          return `
      <div class="action-row">
        <button data-action="delete" data-delete="${credential.id}">Delete</button>
        <div>
          <div><b>${credential.accountName}</b> (${credential.type})</div>
          <div>${openaiDefaultModels.join(",")}</div>
        </div>
      </div>`;

        case "aoai":
          return `
      <div class="action-row"> 
        <button data-action="delete" data-delete="${credential.id}">Delete</button>
        <div>
          <div><b>${new URL(credential.endpoint).hostname}</b></div>
          <div>${credential.deployments}</div> 
        </div>
      </div>`;
      }
    })
    .join("");
}
