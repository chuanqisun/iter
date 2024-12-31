export type Credential = OpenAICredential | AzureOpenAICredential;
export interface OpenAICredential {
  id: string;
  type: "openai";
  accountName: string;
  apiKey: string;
}

export interface AzureOpenAICredential {
  id: string;
  type: "aoai";
  endpoint: string;
  deployments: string;
  apiKey: string;
}

export type Connection = OpenAIConnection | AzureOpenAIConnection;

export interface OpenAIConnection {
  id: string;
  type: "openai";
  displayGroup: string;
  displayName: string;
  model: string;
  apiKey: string;
}

export interface AzureOpenAIConnection {
  id: string;
  type: "aoai";
  displayGroup: string;
  displayName: string;
  endpoint: string;
  deployment: string;
  apiKey: string;
  apiVersion: string;
}

export const connectionsEvents = new EventTarget();

export const openaiDefaultModels = ["gpt-4o", "gpt-4o-mini", "o1-mini"];

export function listCredentials(): Credential[] {
  return tryJSONParse(localStorage.getItem("iter.credentials"), [] as Credential[]);
}

export function listConnections(): Connection[] {
  const credentials = tryJSONParse(localStorage.getItem("iter.credentials"), [] as Credential[]);
  return credentialsToConnections(credentials);
}

export function upsertCredentials(newCredentials: Credential[]): Credential[] {
  const credentials = tryJSONParse(localStorage.getItem("iter.credentials"), [] as Credential[]);
  const mergedCredentials = [...credentials, ...newCredentials];
  localStorage.setItem("iter.credentials", JSON.stringify(mergedCredentials));

  const connections = credentialsToConnections(mergedCredentials);
  connectionsEvents.dispatchEvent(new CustomEvent<Connection[]>("change", { detail: connections }));

  return mergedCredentials;
}

export function deleteCredential(id: string): Credential[] {
  const credentials = tryJSONParse(localStorage.getItem("iter.credentials"), [] as Credential[]);
  const remaining = credentials.filter((credential) => credential.id !== id);
  localStorage.setItem("iter.credentials", JSON.stringify(remaining));

  const connections = credentialsToConnections(remaining);
  connectionsEvents.dispatchEvent(new CustomEvent<Connection[]>("change", { detail: connections }));

  return remaining;
}

export function getConnectionKey(connection: Credential) {
  return connection.id;
}

export function parseOpenAICredential(formData: FormData): OpenAICredential[] {
  const accountName = formData.get("newAccountName") as string;

  return [
    {
      id: crypto.randomUUID(),
      type: "openai",
      accountName: accountName?.length ? accountName : `openai-${new Date().toISOString()}`,
      apiKey: formData.get("newKey") as string,
    },
  ];
}

export function parseAzureOpenAICredential(formData: FormData): AzureOpenAICredential[] {
  const endpoint = ensureTrailingSlash(formData.get("newEndpoint") as string);
  const apiKey = formData.get("newKey") as string;
  const deployments = (formData.get("newDeployments") as string)
    .split(",")
    .map((deployment) => deployment.trim())
    .join(",");

  if (!deployments.length) return [];

  return [
    {
      id: crypto.randomUUID(),
      type: "aoai",
      endpoint,
      deployments,
      apiKey,
    },
  ];
}

function tryJSONParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;

  return JSON.parse(value as string) ?? fallback;
}

function credentialsToConnections(credentials: Credential[]): Connection[] {
  return credentials.flatMap((credential) => {
    switch (credential.type) {
      case "openai":
        return openaiDefaultModels.map(
          (model) =>
            ({
              id: `${model}:${credential.id}`,
              type: "openai",
              displayGroup: credential.accountName,
              displayName: model,
              model,
              apiKey: credential.apiKey,
            } satisfies OpenAIConnection)
        );

      case "aoai": {
        return credential.deployments.split(",").map(
          (deployment) =>
            ({
              id: `${deployment}:${credential.id}`,
              type: "aoai",
              displayGroup: new URL(credential.endpoint).hostname.split(".")[0],
              displayName: deployment,
              endpoint: credential.endpoint,
              deployment,
              apiKey: credential.apiKey,
              apiVersion: "2024-02-15-preview",
            } satisfies AzureOpenAIConnection)
        );
      }
      default:
        return [] as Connection[];
    }
  });
}

function ensureTrailingSlash(url: string) {
  return url.endsWith("/") ? url : url + "/";
}
