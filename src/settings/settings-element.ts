import type { BaseCredential } from "../providers/base";
import { createProvider } from "../providers/factory";
import { deleteCredential, listCredentials, moveCredential, upsertCredentials } from "./connections-store";
import "./settings-element.css";
import templateHtml from "./settings-element.html?raw";

const FIELD_MAP: Record<string, string> = {
  newKey: "apiKey",
  newAccountName: "accountName",
  newModels: "models",
  newEndpoint: "endpoint",
  newDeployments: "deployments",
};

export class SettingsElement extends HTMLElement {
  static define() {
    if (!customElements.get("settings-element")) {
      customElements.define("settings-element", SettingsElement);
    }
  }

  constructor() {
    super();
    this.innerHTML = templateHtml;
  }

  connectedCallback() {
    const existingConnections = this.querySelector("#existing-connections")!;

    const updateConnections = (credentials: BaseCredential[], focusedAction?: string, focusedId?: string) => {
      existingConnections.innerHTML = renderCredentials(credentials);
      if (focusedAction && focusedId) {
        existingConnections
          .querySelector<HTMLElement>(`[data-action="${focusedAction}"][data-id="${focusedId}"]`)
          ?.focus();
      }
    };

    this.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = (e.target as HTMLElement)?.closest<HTMLFormElement>("form");
      if (!form?.reportValidity()) return;

      const parsed = createProvider(form.dataset.type!).parseNewCredentialForm(new FormData(form));
      form.reset();
      updateConnections(upsertCredentials(parsed));
    });

    const actions: Record<string, (btn: HTMLElement) => void> = {
      "move-up": (btn) => {
        updateConnections(moveCredential(btn.dataset.id!, -1), "move-up", btn.dataset.id);
      },

      "move-down": (btn) => {
        updateConnections(moveCredential(btn.dataset.id!, 1), "move-down", btn.dataset.id);
      },

      edit: (btn) => {
        const cred = listCredentials().find((c) => c.id === btn.dataset.id);
        if (!cred) return;

        const radio = this.querySelector<HTMLInputElement>(`input[name="newType"][value="${cred.type}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const form = this.querySelector<HTMLFormElement>(`form[data-type="${cred.type}"]`);
        if (!form) return;

        const record = cred as unknown as Record<string, unknown>;
        for (const [inputName, prop] of Object.entries(FIELD_MAP)) {
          const input = form.querySelector<HTMLInputElement>(`input[name="${inputName}"]`);
          if (input && prop in record) {
            input.value = String(record[prop] ?? "");
          }
        }
      },

      delete: (btn) => {
        updateConnections(deleteCredential(btn.dataset.id!));
      },

      close: () => this.closest("dialog")?.close(),
    };

    this.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement)?.closest<HTMLElement>("[data-action]");
      if (btn?.dataset.action) actions[btn.dataset.action]?.(btn);
    });

    updateConnections(listCredentials());
  }
}

function renderCredentials(credentials: BaseCredential[]) {
  if (!credentials.length) return "There are no existing connections.";

  return credentials
    .map((c) => {
      const { title, tagLine, features } = createProvider(c.type).getCredentialSummary(c);

      return `<div class="action-row">
        <div>
          <div><b>${title}</b> (${tagLine})</div>
          <div>${features}</div>
        </div>
        <div class="action-buttons">
          <button type="button" data-action="move-up" data-id="${c.id}" aria-label="Move up">▲</button>
          <button type="button" data-action="move-down" data-id="${c.id}" aria-label="Move down">▼</button>
          <button type="button" data-action="edit" data-id="${c.id}">Edit</button>
          <button type="button" data-action="delete" data-id="${c.id}">Delete</button>
        </div>
      </div>`;
    })
    .join("");
}
