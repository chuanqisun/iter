import {
  deleteConnection,
  getConnectionKey,
  listConnections,
  parseAzureOpenAIConnection,
  type ParsedConnection,
  parseOpenAIConnection,
  upsertConnections,
} from "./connections";
import "./settings-element.css";

export function defineSettingsElement() {
  customElements.define("settings-element", SettingsElement);
}

export interface Settings {}
export interface OpenAIChatProvider {
  type: "openai";
  endpoint: string;
  apiKey: string;
}

export interface AOAIChatProvider {
  type: "aoai";
  endpoint: string;
  apiKey: string;
}

export class SettingsElement extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <form method="dialog">
        <div class="form-scroll">
          <fieldset>
            <legend>Update</legend>

            <div class="rows">

            <div class="field">
              <div class="radio-group">
                <label><input name="newType" type="radio" value="openai" checked /> OpenAI</label>
                <label><input name="newType" type="radio" value="aoai" /> Azure OpenAI</label>
              </div>
            </div>

            <div class="field" data-type="aoai">
              <label for="newEndpoint">Endpoint</label>
              <input id="newEndpoint" name="newEndpoint" type="url" placeholder="https://project-name.openai.azure.com/" disabled required />
            </div>

            <div class="field">
              <label for="newKey">Key</label>
              <input id="newKey" name="newKey" type="password" required />
            </div>

            <div class="field" >
              <label for="newNickname">Nickname (optional)</label>
              <input id="newNickname" name="newNickname" type="text" placeholder="work" />
            </div>

            <button type="button" data-action="upsert">Submit</button>
            </div>
          </fieldset>

          <fieldset> 
            <legend>Existing</legend>
            <div class="rows" id="existing-connections">
              
            </div>
          </fieldset>
        </div>


        <div>
          <button type="button" data-action="close">OK</button>
        </div>
      </form>
    `;
  }

  connectedCallback() {
    const form = this.querySelector("form")!;
    const existingConnections = this.querySelector("#existing-connections")!;

    form.addEventListener("change", (e) => {
      const type = new FormData(form).get("newType") as string;
      this.querySelector(`[name="newEndpoint"]`)?.toggleAttribute("disabled", type !== "aoai");
    });

    this.addEventListener("click", (e) => {
      const targetForm = (e.target as HTMLElement)?.closest("form")!;

      const targetActionTrigger = (e.target as HTMLElement)?.closest(`[data-action]`);
      const action = targetActionTrigger?.getAttribute("data-action");

      switch (action) {
        case "upsert":
          {
            const isValid = targetForm.reportValidity();
            if (!isValid) return;

            const formData = new FormData(targetForm);
            const { newType, newEndpoint, newKey, newNickname } = Object.fromEntries(formData.entries()) as Record<string, string>;

            let parsed: ParsedConnection[] = [];
            if (newType === "openai") {
              parsed = parseOpenAIConnection(newNickname, newKey as string);
            } else if (newType === "aoai") {
              parsed = parseAzureOpenAIConnection(newNickname, newEndpoint as string, newKey as string);
            }
            if (!parsed) return;

            const updatedConnections = upsertConnections(parsed);
            existingConnections.innerHTML = toPreviewHTML(updatedConnections);
          }
          break;

        case "delete": {
          const deleteKey = targetActionTrigger?.getAttribute("data-delete")!;
          const remaining = deleteConnection(deleteKey);
          existingConnections.innerHTML = toPreviewHTML(remaining);

          break;
        }

        case "close": {
          this.closest("dialog")?.close();
          break;
        }
      }
    });

    existingConnections.innerHTML = toPreviewHTML(listConnections());
  }
}

function toPreviewHTML(connections: ParsedConnection[]) {
  if (!connections.length) return "There are no existing connections.";
  return connections
    .map((connection) => {
      const key = getConnectionKey(connection);
      return `<div class="action-row">
      <button data-action="delete" data-delete="${key}">Delete</button>
      <div>
        <div>${key}</div>
        <div>${connection.endpoint}</div>
      </div>
    </div>`;
    })
    .join("");
}
