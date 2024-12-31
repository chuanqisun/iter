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

            let parsed: any = null;
            if (newType === "openai") {
              parsed = parseOpenAIConnection(newNickname, newKey as string);
            } else if (newType === "aoai") {
              parsed = parseAzureOpenAIConnection(newNickname, newEndpoint as string, newKey as string);
            }
            if (!parsed) return;

            const persistedConnections = tryJSONParse(localStorage.getItem("iter:connections"), [] as ParsedConnection[]);
            const mergedConnections = mergeConnections([...persistedConnections, ...parsed]);
            localStorage.setItem("iter:connections", JSON.stringify(mergedConnections));

            existingConnections.innerHTML = toPreviewHTML(mergedConnections);
          }
          break;

        case "delete": {
          const deleteKey = targetActionTrigger?.getAttribute("data-delete")!;
          const persistedConnections = tryJSONParse(localStorage.getItem("iter:connections"), [] as ParsedConnection[]);
          const remaining = mergeConnections(persistedConnections).filter((connection) => {
            return `${connection.groupName}/${connection.optionName}` !== deleteKey;
          });
          localStorage.setItem("iter:connections", JSON.stringify(remaining));

          existingConnections.innerHTML = toPreviewHTML(remaining);

          break;
        }

        case "close": {
          this.closest("dialog")?.close();
          break;
        }
      }
    });

    // initialize
    const persistedConnections = tryJSONParse(localStorage.getItem("iter:connections"), [] as ParsedConnection[]);
    existingConnections.innerHTML = toPreviewHTML(mergeConnections(persistedConnections));
  }
}

export interface ParsedConnection {
  type: "openai" | "aoai";
  endpoint: string;
  apiKey: string;
  groupName: string;
  optionName: string;
}

function parseOpenAIConnection(nickname: string, apiKey: string): ParsedConnection[] {
  return [
    {
      type: "openai",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey,
      groupName: nickname.length ? nickname : "openai",
      optionName: "gpt-4o",
    },
    {
      type: "openai",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey,
      groupName: nickname.length ? nickname : "openai",
      optionName: "gpt-4o-mini",
    },
  ];
}

function parseAzureOpenAIConnection(nickname: string, endpoint: string, apiKey: string): ParsedConnection[] {
  // e.g. https://{{project_name}}.openai.azure.com/openai/deployments/{{deployment_name}}/chat/completions?api-version=2024-02-15-preview
  if (endpoint.includes("openai.azure.com")) {
    const aoaiURLPattern = /https:\/\/([^.]+)\.openai\.azure\.com\/openai\/deployments\/([^\/]+)(?:(\/.*)|$)/;

    const match = endpoint.match(aoaiURLPattern);
    if (!match) throw new Error("Invalid AOAI endpoint");
    const [, projectName, deploymentName] = match;

    return [
      {
        type: "aoai",
        endpoint: `https://${projectName}.openai.azure.com/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`,
        apiKey,
        groupName: nickname.length ? nickname : projectName,
        optionName: deploymentName,
      },
    ];
  }

  return [];
}

function tryJSONParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;

  return JSON.parse(value as string) ?? fallback;
}

function mergeConnections(connections: ParsedConnection[]): ParsedConnection[] {
  // ensure the combination of all fields are unique, and let newer value overrides older value.
  const map = new Map<string, ParsedConnection>();
  for (const connection of connections) {
    const key = JSON.stringify(connection.groupName + connection.optionName);
    map.set(key, connection);
  }

  const items = Array.from(map.values());

  // sort by groupName + optionName
  const sorted = items.sort((a, b) => {
    const aKey = `${a.groupName}/${a.optionName}`;
    const bKey = `${b.groupName}/${b.optionName}`;
    return aKey.localeCompare(bKey);
  });

  return sorted;
}

function toPreviewHTML(connections: ParsedConnection[]) {
  if (!connections.length) return "There are no existing connections.";
  return connections
    .map((connection) => {
      return `<div class="action-row">
      <button data-action="delete" data-delete="${connection.groupName}/${connection.optionName}">Delete</button>
      <div>
        <div>${connection.groupName}/${connection.optionName}</div>
        <div>${connection.endpoint}</div>
      </div>
    </div>`;
    })
    .join("");
}
