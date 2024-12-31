export interface ParsedConnection {
  type: "openai" | "aoai";
  endpoint: string;
  apiKey: string;
  groupName: string;
  optionName: string;
}

export function listConnections(): ParsedConnection[] {
  const persistedConnections = tryJSONParse(localStorage.getItem("iter:connections"), [] as ParsedConnection[]);
  return mergeConnections(persistedConnections);
}

export function upsertConnections(connections: ParsedConnection[]): ParsedConnection[] {
  const persistedConnections = tryJSONParse(localStorage.getItem("iter:connections"), [] as ParsedConnection[]);
  const mergedConnections = mergeConnections([...persistedConnections, ...connections]);
  localStorage.setItem("iter:connections", JSON.stringify(mergedConnections));
  return mergedConnections;
}

export function deleteConnection(key: string): ParsedConnection[] {
  const persistedConnections = tryJSONParse(localStorage.getItem("iter:connections"), [] as ParsedConnection[]);
  const remaining = mergeConnections(persistedConnections).filter((connection) => {
    return getConnectionKey(connection) !== key;
  });
  localStorage.setItem("iter:connections", JSON.stringify(remaining));

  return remaining;
}

export function getConnectionKey(connection: ParsedConnection) {
  return `${connection.groupName}/${connection.optionName}`;
}

export function parseOpenAIConnection(nickname: string, apiKey: string): ParsedConnection[] {
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

export function parseAzureOpenAIConnection(nickname: string, endpoint: string, apiKey: string): ParsedConnection[] {
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
  connections.forEach((connection) => map.set(getConnectionKey(connection), connection));
  const items = Array.from(map.values());
  const sorted = items.sort((a, b) => getConnectionKey(a).localeCompare(getConnectionKey(b)));

  return sorted;
}
